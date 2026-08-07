use crate::cli::DiscoveryStatusFilter;
use crate::cli::discovery::{
    default_discovery_connection_name, discovery_result_can_import, discovery_result_key,
    discovery_result_matches_query, displayed_result_status, result_matches_filter,
};
use crate::config::connection_store;
use crate::config::device_discovery_store::{self, DiscoveryResultRecord};
use crate::web::handlers::import_device_discovery_run_results;
use crate::web::models::{
    DiscoveryRunDetailResponse, ImportDiscoveryResultItem, ImportDiscoveryResultsRequest,
};
use crate::web::state::AppState;
use anyhow::{Context, Result};
use crossterm::cursor::Show;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Clear, Paragraph, Row, Table, TableState, Wrap};
use ratatui::{Frame, Terminal};
use std::collections::{HashMap, HashSet};
use std::io;
use std::sync::Arc;
use std::time::Duration;

const FILTERS: [DiscoveryStatusFilter; 10] = [
    DiscoveryStatusFilter::All,
    DiscoveryStatusFilter::Identified,
    DiscoveryStatusFilter::Existing,
    DiscoveryStatusFilter::Imported,
    DiscoveryStatusFilter::Reachable,
    DiscoveryStatusFilter::Failed,
    DiscoveryStatusFilter::NotSsh,
    DiscoveryStatusFilter::ProbeFailed,
    DiscoveryStatusFilter::Unreachable,
    DiscoveryStatusFilter::Cancelled,
];

#[derive(Debug, Default)]
pub(crate) struct DiscoveryTuiOutcome {
    pub saved: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum InputMode {
    Browse,
    Search,
    EditName,
}

enum TuiAction {
    Continue,
    Save,
    Quit,
}

struct DiscoveryTui {
    detail: DiscoveryRunDetailResponse,
    filter: DiscoveryStatusFilter,
    search: String,
    selected: HashSet<String>,
    connection_names: HashMap<String, String>,
    table_state: TableState,
    input_mode: InputMode,
    edit_key: Option<String>,
    edit_buffer: String,
    notice: String,
    saved: usize,
}

impl DiscoveryTui {
    fn new(detail: DiscoveryRunDetailResponse, filter: DiscoveryStatusFilter) -> Self {
        let mut selected = HashSet::new();
        let mut connection_names = HashMap::new();
        for result in &detail.results {
            let key = discovery_result_key(result);
            connection_names.insert(key.clone(), default_discovery_connection_name(result));
            if discovery_result_can_import(result) {
                selected.insert(key);
            }
        }
        Self {
            detail,
            filter,
            search: String::new(),
            selected,
            connection_names,
            table_state: TableState::default().with_selected(0),
            input_mode: InputMode::Browse,
            edit_key: None,
            edit_buffer: String::new(),
            notice: String::new(),
            saved: 0,
        }
    }

    fn filtered_indices(&self) -> Vec<usize> {
        let query = self.search.trim().to_ascii_lowercase();
        self.detail
            .results
            .iter()
            .enumerate()
            .filter(|(_, result)| result_matches_filter(result, self.filter))
            .filter(|(_, result)| discovery_result_matches_query(result, &query))
            .map(|(index, _)| index)
            .collect()
    }

    fn normalize_cursor(&mut self) {
        let len = self.filtered_indices().len();
        let selected = self.table_state.selected().unwrap_or(0);
        self.table_state
            .select((len > 0).then_some(selected.min(len.saturating_sub(1))));
    }

    fn selected_result(&self) -> Option<&DiscoveryResultRecord> {
        let indices = self.filtered_indices();
        let visible_index = self.table_state.selected()?;
        indices
            .get(visible_index)
            .and_then(|index| self.detail.results.get(*index))
    }

    fn move_cursor(&mut self, offset: isize) {
        let len = self.filtered_indices().len();
        if len == 0 {
            self.table_state.select(None);
            return;
        }
        let current = self.table_state.selected().unwrap_or(0) as isize;
        let next = (current + offset).clamp(0, len as isize - 1) as usize;
        self.table_state.select(Some(next));
    }

    fn select_edge(&mut self, last: bool) {
        let len = self.filtered_indices().len();
        self.table_state
            .select((len > 0).then_some(if last { len - 1 } else { 0 }));
    }

    fn toggle_selected(&mut self) {
        let Some(result) = self.selected_result() else {
            return;
        };
        if !discovery_result_can_import(result) {
            self.notice = "Only newly identified devices can be selected".to_string();
            return;
        }
        let key = discovery_result_key(result);
        if !self.selected.remove(&key) {
            self.selected.insert(key);
        }
        self.notice.clear();
    }

    fn toggle_all_visible(&mut self) {
        let keys = self
            .filtered_indices()
            .into_iter()
            .filter_map(|index| self.detail.results.get(index))
            .filter(|result| discovery_result_can_import(result))
            .map(discovery_result_key)
            .collect::<Vec<_>>();
        let all_selected = !keys.is_empty() && keys.iter().all(|key| self.selected.contains(key));
        for key in keys {
            if all_selected {
                self.selected.remove(&key);
            } else {
                self.selected.insert(key);
            }
        }
        self.notice.clear();
    }

    fn cycle_filter(&mut self, offset: isize) {
        let current = FILTERS
            .iter()
            .position(|filter| *filter == self.filter)
            .unwrap_or(0) as isize;
        let next = (current + offset).rem_euclid(FILTERS.len() as isize) as usize;
        self.filter = FILTERS[next];
        self.table_state.select(Some(0));
        self.normalize_cursor();
        self.notice.clear();
    }

    fn begin_edit_name(&mut self) {
        let Some(result) = self.selected_result() else {
            return;
        };
        if !discovery_result_can_import(result) {
            self.notice = "This result cannot be saved as a connection".to_string();
            return;
        }
        let key = discovery_result_key(result);
        self.edit_buffer = self
            .connection_names
            .get(&key)
            .cloned()
            .unwrap_or_else(|| default_discovery_connection_name(result));
        self.edit_key = Some(key);
        self.input_mode = InputMode::EditName;
        self.notice.clear();
    }

    fn handle_key(&mut self, key: KeyEvent) -> TuiAction {
        if key.kind != KeyEventKind::Press {
            return TuiAction::Continue;
        }
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            return TuiAction::Quit;
        }
        match self.input_mode {
            InputMode::Search => self.handle_search_key(key),
            InputMode::EditName => self.handle_edit_key(key),
            InputMode::Browse => self.handle_browse_key(key),
        }
    }

    fn handle_search_key(&mut self, key: KeyEvent) -> TuiAction {
        match key.code {
            KeyCode::Esc | KeyCode::Enter => self.input_mode = InputMode::Browse,
            KeyCode::Backspace => {
                self.search.pop();
                self.table_state.select(Some(0));
                self.normalize_cursor();
            }
            KeyCode::Char(character) => {
                self.search.push(character);
                self.table_state.select(Some(0));
                self.normalize_cursor();
            }
            _ => {}
        }
        TuiAction::Continue
    }

    fn handle_edit_key(&mut self, key: KeyEvent) -> TuiAction {
        match key.code {
            KeyCode::Esc => {
                self.input_mode = InputMode::Browse;
                self.edit_key = None;
                self.edit_buffer.clear();
            }
            KeyCode::Enter => match connection_store::safe_connection_name(&self.edit_buffer) {
                Ok(name) => {
                    if let Some(key) = self.edit_key.take() {
                        self.connection_names.insert(key, name);
                    }
                    self.edit_buffer.clear();
                    self.input_mode = InputMode::Browse;
                    self.notice = "Connection name updated".to_string();
                }
                Err(error) => self.notice = error.to_string(),
            },
            KeyCode::Backspace => {
                self.edit_buffer.pop();
            }
            KeyCode::Char(character) => self.edit_buffer.push(character),
            _ => {}
        }
        TuiAction::Continue
    }

    fn handle_browse_key(&mut self, key: KeyEvent) -> TuiAction {
        match key.code {
            KeyCode::Char('q') => return TuiAction::Quit,
            KeyCode::Up | KeyCode::Char('k') => self.move_cursor(-1),
            KeyCode::Down | KeyCode::Char('j') => self.move_cursor(1),
            KeyCode::Home => self.select_edge(false),
            KeyCode::End => self.select_edge(true),
            KeyCode::Left | KeyCode::Char('F') => self.cycle_filter(-1),
            KeyCode::Right | KeyCode::Char('f') => self.cycle_filter(1),
            KeyCode::Char(' ') => self.toggle_selected(),
            KeyCode::Char('a') => self.toggle_all_visible(),
            KeyCode::Char('/') => {
                self.input_mode = InputMode::Search;
                self.notice.clear();
            }
            KeyCode::Char('e') => self.begin_edit_name(),
            KeyCode::Char('s') => return TuiAction::Save,
            KeyCode::Esc if !self.search.is_empty() => {
                self.search.clear();
                self.table_state.select(Some(0));
                self.normalize_cursor();
            }
            _ => {}
        }
        TuiAction::Continue
    }

    async fn save_selected(&mut self, state: Arc<AppState>) {
        let items = self
            .detail
            .results
            .iter()
            .filter(|result| discovery_result_can_import(result))
            .filter(|result| self.selected.contains(&discovery_result_key(result)))
            .map(|result| {
                let key = discovery_result_key(result);
                ImportDiscoveryResultItem {
                    host: result.host.clone(),
                    port: result.port,
                    connection_name: self
                        .connection_names
                        .get(&key)
                        .cloned()
                        .unwrap_or_else(|| default_discovery_connection_name(result)),
                    credential_id: result.credential_id.clone(),
                    groups: None,
                    labels: None,
                    overwrite: false,
                }
            })
            .collect::<Vec<_>>();
        if items.is_empty() {
            self.notice = "No importable devices are selected".to_string();
            return;
        }

        self.notice = format!("Saving {} selected connection(s)...", items.len());
        let run_id = self.detail.run.id.clone();
        match import_device_discovery_run_results(
            state,
            run_id.clone(),
            ImportDiscoveryResultsRequest { items },
        )
        .await
        {
            Ok(response) => {
                self.saved += response.created + response.updated;
                self.notice = format!(
                    "Saved: {} created, {} updated, {} skipped, {} failed",
                    response.created, response.updated, response.skipped, response.failed
                );
                if let Some(error) = response
                    .results
                    .iter()
                    .find_map(|result| result.error.as_ref())
                {
                    self.notice.push_str(&format!("; {error}"));
                }
                if let Ok(Some(run)) = device_discovery_store::get_run(&run_id).await
                    && let Ok(results) = device_discovery_store::list_results(&run_id).await
                {
                    self.detail = DiscoveryRunDetailResponse { run, results };
                }
                self.selected.retain(|key| {
                    self.detail
                        .results
                        .iter()
                        .find(|result| discovery_result_key(result) == *key)
                        .is_some_and(discovery_result_can_import)
                });
                self.normalize_cursor();
            }
            Err(error) => self.notice = format!("Save failed: {}", error.message),
        }
    }

    fn draw(&mut self, frame: &mut Frame) {
        let sections = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(5),
                Constraint::Min(7),
                Constraint::Length(7),
                Constraint::Length(5),
            ])
            .split(frame.area());
        self.draw_summary(frame, sections[0]);
        self.draw_table(frame, sections[1]);
        self.draw_detail(frame, sections[2]);
        self.draw_footer(frame, sections[3]);

        if self.input_mode == InputMode::EditName {
            self.draw_edit_popup(frame);
        }
    }

    fn draw_summary(&self, frame: &mut Frame, area: Rect) {
        let run = &self.detail.run;
        let filter = filter_label(self.filter);
        let search = if self.search.is_empty() {
            "-"
        } else {
            &self.search
        };
        let input_marker = if self.input_mode == InputMode::Search {
            "_"
        } else {
            ""
        };
        let lines = vec![
            Line::from(vec![
                Span::styled("RUN  ", muted_style()),
                Span::styled(&run.id, Style::default().fg(Color::White)),
                Span::raw("   "),
                Span::styled("STATUS  ", muted_style()),
                Span::styled(
                    format!(" {} ", run.status.to_ascii_uppercase()),
                    status_style(&run.status).add_modifier(Modifier::BOLD | Modifier::REVERSED),
                ),
            ]),
            Line::from(vec![
                Span::styled("SCAN ", muted_style()),
                Span::styled(
                    format!("{}/{}", run.scanned_targets, run.total_targets),
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("   SSH ", muted_style()),
                Span::styled(
                    format!("{}/{}", run.probed_targets, run.reachable_count),
                    Style::default()
                        .fg(Color::LightBlue)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("   IDENTIFIED ", muted_style()),
                Span::styled(
                    run.identified_count.to_string(),
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("   FAILED ", muted_style()),
                Span::styled(
                    run.failed_count.to_string(),
                    Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                ),
            ]),
            Line::from(vec![
                Span::styled("FILTER ", muted_style()),
                Span::styled(
                    format!(" {filter} "),
                    Style::default()
                        .fg(Color::Yellow)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled("   SEARCH ", muted_style()),
                Span::styled(
                    format!("{search}{input_marker}"),
                    Style::default().fg(if self.input_mode == InputMode::Search {
                        Color::Yellow
                    } else {
                        Color::Cyan
                    }),
                ),
                Span::styled("   SELECTED ", muted_style()),
                Span::styled(
                    self.selected.len().to_string(),
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD),
                ),
            ]),
        ];
        frame.render_widget(
            Paragraph::new(lines).block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Cyan))
                    .title(Span::styled(
                        " DEVICE DISCOVERY ",
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    )),
            ),
            area,
        );
    }

    fn draw_table(&mut self, frame: &mut Frame, area: Rect) {
        let indices = self.filtered_indices();
        let table_variant = if area.width < 90 {
            0
        } else if area.width < 110 {
            1
        } else {
            2
        };
        let rows = indices.iter().filter_map(|index| {
            let result = self.detail.results.get(*index)?;
            let key = discovery_result_key(result);
            let status = displayed_result_status(result);
            let marker = if discovery_result_can_import(result) {
                if self.selected.contains(&key) {
                    "[x]"
                } else {
                    "[ ]"
                }
            } else {
                "[-]"
            };
            let connection = if discovery_result_can_import(result) {
                self.connection_names
                    .get(&key)
                    .cloned()
                    .unwrap_or_else(|| default_discovery_connection_name(result))
            } else {
                result
                    .imported_connection_name
                    .clone()
                    .or_else(|| result.existing_connection_name.clone())
                    .unwrap_or_else(|| "-".to_string())
            };
            let marker_cell = Cell::from(Span::styled(
                marker,
                if self.selected.contains(&key) && discovery_result_can_import(result) {
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD)
                } else {
                    muted_style()
                },
            ));
            let endpoint_cell = Cell::from(format!("{}:{}", result.host, result.port))
                .style(Style::default().fg(Color::White));
            let status_cell = Cell::from(status.to_string())
                .style(status_style(status).add_modifier(Modifier::BOLD));
            let profile_cell = Cell::from(result.device_profile.as_deref().unwrap_or("-"))
                .style(Style::default().fg(Color::Cyan));
            let connection_cell =
                Cell::from(connection).style(if discovery_result_can_import(result) {
                    Style::default().fg(Color::Yellow)
                } else {
                    Style::default().fg(Color::White)
                });
            let cells = match table_variant {
                0 => vec![marker_cell, endpoint_cell, status_cell, connection_cell],
                1 => vec![
                    marker_cell,
                    endpoint_cell,
                    status_cell,
                    profile_cell,
                    connection_cell,
                ],
                _ => vec![
                    marker_cell,
                    endpoint_cell,
                    status_cell,
                    profile_cell,
                    Cell::from(result.device_model.as_deref().unwrap_or("-"))
                        .style(Style::default().fg(Color::LightBlue)),
                    connection_cell,
                ],
            };
            Some(Row::new(cells).height(1))
        });
        let title = format!(
            " Results ({}/{}) ",
            indices.len(),
            self.detail.results.len()
        );
        let (headers, widths) = match table_variant {
            0 => (
                vec!["", "Endpoint", "Status", "Connection"],
                vec![
                    Constraint::Length(4),
                    Constraint::Length(22),
                    Constraint::Length(13),
                    Constraint::Min(18),
                ],
            ),
            1 => (
                vec!["", "Endpoint", "Status", "Profile", "Connection"],
                vec![
                    Constraint::Length(4),
                    Constraint::Length(22),
                    Constraint::Length(13),
                    Constraint::Length(16),
                    Constraint::Min(18),
                ],
            ),
            _ => (
                vec!["", "Endpoint", "Status", "Profile", "Model", "Connection"],
                vec![
                    Constraint::Length(4),
                    Constraint::Length(24),
                    Constraint::Length(13),
                    Constraint::Length(17),
                    Constraint::Length(20),
                    Constraint::Min(18),
                ],
            ),
        };
        let table = Table::new(rows, widths)
            .header(
                Row::new(headers).style(
                    Style::default()
                        .fg(Color::White)
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                ),
            )
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Blue))
                    .title(Span::styled(
                        title,
                        Style::default()
                            .fg(Color::LightBlue)
                            .add_modifier(Modifier::BOLD),
                    )),
            )
            .row_highlight_style(
                Style::default()
                    .fg(Color::White)
                    .bg(Color::Blue)
                    .add_modifier(Modifier::BOLD),
            )
            .highlight_symbol("> ");
        frame.render_stateful_widget(table, area, &mut self.table_state);
    }

    fn draw_detail(&self, frame: &mut Frame, area: Rect) {
        let lines = if let Some(result) = self.selected_result() {
            let latency = result
                .latency_ms
                .map(|value| value.to_string())
                .unwrap_or_else(|| "-".to_string());
            let connection_name = self
                .connection_names
                .get(&discovery_result_key(result))
                .map(String::as_str)
                .or(result.imported_connection_name.as_deref())
                .or(result.existing_connection_name.as_deref())
                .unwrap_or("-");
            vec![
                Line::from(vec![
                    Span::styled("ENDPOINT  ", muted_style()),
                    Span::styled(
                        format!("{}:{}", result.host, result.port),
                        Style::default()
                            .fg(Color::White)
                            .add_modifier(Modifier::BOLD),
                    ),
                    Span::styled("   STATUS  ", muted_style()),
                    Span::styled(
                        displayed_result_status(result),
                        status_style(displayed_result_status(result)).add_modifier(Modifier::BOLD),
                    ),
                ]),
                Line::from(vec![
                    Span::styled("PROFILE  ", muted_style()),
                    Span::styled(
                        result.device_profile.as_deref().unwrap_or("-"),
                        Style::default().fg(Color::Cyan),
                    ),
                    Span::styled("   MODEL  ", muted_style()),
                    Span::styled(
                        result.device_model.as_deref().unwrap_or("-"),
                        Style::default().fg(Color::LightBlue),
                    ),
                    Span::styled("   VERSION  ", muted_style()),
                    Span::styled(
                        result.software_version.as_deref().unwrap_or("-"),
                        Style::default().fg(Color::White),
                    ),
                ]),
                Line::from(vec![
                    Span::styled("CONNECTION  ", muted_style()),
                    Span::styled(connection_name, Style::default().fg(Color::Yellow)),
                ]),
                Line::from(vec![
                    Span::styled("CREDENTIAL  ", muted_style()),
                    Span::styled(
                        result.credential_id.as_deref().unwrap_or("-"),
                        Style::default().fg(Color::White),
                    ),
                    Span::styled("   LATENCY  ", muted_style()),
                    Span::styled(format!("{latency} ms"), Style::default().fg(Color::Green)),
                ]),
                Line::from(vec![
                    Span::styled("ERROR  ", muted_style()),
                    Span::styled(
                        result.error.as_deref().unwrap_or("-"),
                        Style::default().fg(if result.error.is_some() {
                            Color::Red
                        } else {
                            Color::DarkGray
                        }),
                    ),
                ]),
            ]
        } else {
            vec![Line::from(Span::styled(
                "No result matches the current filter",
                Style::default().fg(Color::Yellow),
            ))]
        };
        frame.render_widget(
            Paragraph::new(lines).block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Magenta))
                    .title(Span::styled(
                        " FOCUSED DEVICE ",
                        Style::default()
                            .fg(Color::Magenta)
                            .add_modifier(Modifier::BOLD),
                    )),
            ),
            area,
        );
    }

    fn draw_footer(&self, frame: &mut Frame, area: Rect) {
        let notice = if self.notice.is_empty() {
            format!("{} selected", self.selected.len())
        } else {
            self.notice.clone()
        };
        let primary_controls = vec![
            key_hint("j/k", "move"),
            Span::raw("  "),
            key_hint("Space", "select"),
            Span::raw("  "),
            key_hint("a", "all"),
            Span::raw("  "),
            key_hint("f/F", "filter"),
        ];
        let secondary_controls = vec![
            key_hint("/", "search"),
            Span::raw("  "),
            key_hint("e", "rename"),
            Span::raw("  "),
            key_hint("s", "save"),
            Span::raw("  "),
            key_hint("q", "quit"),
        ];
        let mut lines = if area.width < 105 {
            vec![Line::from(primary_controls), Line::from(secondary_controls)]
        } else {
            let mut controls = primary_controls;
            controls.push(Span::raw("  "));
            controls.extend(secondary_controls);
            vec![Line::from(controls)]
        };
        lines.push(Line::from(vec![
            Span::styled("* ", notice_style(&notice)),
            Span::styled(notice.clone(), notice_style(&notice)),
        ]));
        frame.render_widget(
            Paragraph::new(lines).block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::DarkGray)),
            ),
            area,
        );
    }

    fn draw_edit_popup(&self, frame: &mut Frame) {
        let area = centered_rect(70, 5, frame.area());
        frame.render_widget(Clear, area);
        frame.render_widget(
            Paragraph::new(format!("{}_", self.edit_buffer))
                .style(Style::default().fg(Color::White))
                .block(
                    Block::default()
                        .borders(Borders::ALL)
                        .border_style(Style::default().fg(Color::Yellow))
                        .title(Span::styled(
                            " CONNECTION NAME | Enter save | Esc cancel ",
                            Style::default()
                                .fg(Color::Yellow)
                                .add_modifier(Modifier::BOLD),
                        )),
                )
                .wrap(Wrap { trim: false }),
            area,
        );
    }
}

pub(crate) async fn run_discovery_tui(
    state: Arc<AppState>,
    detail: DiscoveryRunDetailResponse,
    initial_filter: DiscoveryStatusFilter,
) -> Result<DiscoveryTuiOutcome> {
    enable_raw_mode().context("failed to enable terminal raw mode")?;
    let mut stdout = io::stdout();
    if let Err(error) = execute!(stdout, EnterAlternateScreen) {
        let _ = disable_raw_mode();
        return Err(error).context("failed to enter alternate terminal screen");
    }
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = match Terminal::new(backend) {
        Ok(terminal) => terminal,
        Err(error) => {
            let _ = disable_raw_mode();
            let mut stdout = io::stdout();
            let _ = execute!(stdout, LeaveAlternateScreen, Show);
            return Err(error).context("failed to initialize terminal interface");
        }
    };

    let result = run_tui_loop(&mut terminal, state, detail, initial_filter).await;
    let raw_mode_result = disable_raw_mode();
    let leave_result = execute!(terminal.backend_mut(), LeaveAlternateScreen, Show);
    let cursor_result = terminal.show_cursor();
    raw_mode_result.context("failed to disable terminal raw mode")?;
    leave_result.context("failed to restore terminal screen")?;
    cursor_result.context("failed to restore terminal cursor")?;
    result
}

async fn run_tui_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    state: Arc<AppState>,
    detail: DiscoveryRunDetailResponse,
    initial_filter: DiscoveryStatusFilter,
) -> Result<DiscoveryTuiOutcome> {
    let mut app = DiscoveryTui::new(detail, initial_filter);
    loop {
        terminal.draw(|frame| app.draw(frame))?;
        if !event::poll(Duration::from_millis(200))? {
            continue;
        }
        let Event::Key(key) = event::read()? else {
            continue;
        };
        match app.handle_key(key) {
            TuiAction::Continue => {}
            TuiAction::Save => app.save_selected(state.clone()).await,
            TuiAction::Quit => return Ok(DiscoveryTuiOutcome { saved: app.saved }),
        }
    }
}

fn filter_label(filter: DiscoveryStatusFilter) -> &'static str {
    match filter {
        DiscoveryStatusFilter::All => "all",
        DiscoveryStatusFilter::Identified => "identified",
        DiscoveryStatusFilter::Existing => "existing",
        DiscoveryStatusFilter::Imported => "imported",
        DiscoveryStatusFilter::Reachable => "reachable",
        DiscoveryStatusFilter::Failed => "failed",
        DiscoveryStatusFilter::NotSsh => "not-ssh",
        DiscoveryStatusFilter::ProbeFailed => "probe-failed",
        DiscoveryStatusFilter::Unreachable => "unreachable",
        DiscoveryStatusFilter::Cancelled => "cancelled",
    }
}

fn muted_style() -> Style {
    Style::default().fg(Color::DarkGray)
}

fn key_hint(key: &'static str, label: &'static str) -> Span<'static> {
    Span::styled(
        format!("[{key}] {label}"),
        Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD),
    )
}

fn notice_style(notice: &str) -> Style {
    let color = if notice.starts_with("Saved:") || notice.starts_with("Connection name updated") {
        Color::Green
    } else if notice.starts_with("Save failed")
        || notice.starts_with("No ")
        || notice.contains("cannot")
    {
        Color::Red
    } else {
        Color::Yellow
    };
    Style::default().fg(color).add_modifier(Modifier::BOLD)
}

fn status_style(status: &str) -> Style {
    match status {
        "identified" | "completed" => Style::default().fg(Color::Green),
        "existing" | "reachable" | "running" => Style::default().fg(Color::Cyan),
        "imported" => Style::default().fg(Color::Magenta),
        "queued" | "cancelling" => Style::default().fg(Color::Yellow),
        _ => Style::default().fg(Color::Red),
    }
}

fn centered_rect(percent_x: u16, height: u16, area: Rect) -> Rect {
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(area.height.saturating_sub(height) / 2),
            Constraint::Length(height.min(area.height)),
            Constraint::Min(0),
        ])
        .split(area);
    let horizontal = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(vertical[1]);
    horizontal[1]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::device_discovery_store::DiscoveryRunRecord;
    use ratatui::backend::TestBackend;

    fn result(status: &str) -> DiscoveryResultRecord {
        DiscoveryResultRecord {
            run_id: "run-1".to_string(),
            host: "192.0.2.10".to_string(),
            port: 22,
            status: status.to_string(),
            latency_ms: Some(1),
            credential_id: Some("credential-1".to_string()),
            device_profile: Some("cisco_ios".to_string()),
            device_model: Some("C9300".to_string()),
            software_version: Some("17.9".to_string()),
            existing_connection_name: None,
            imported_connection_name: None,
            error: None,
            updated_at_ms: 1,
        }
    }

    fn detail() -> DiscoveryRunDetailResponse {
        DiscoveryRunDetailResponse {
            run: DiscoveryRunRecord {
                id: "run-1".to_string(),
                status: "completed".to_string(),
                phase: "completed".to_string(),
                targets: vec!["192.0.2.10".to_string()],
                ports: vec![22],
                credential_ids: vec!["credential-1".to_string()],
                default_groups: Vec::new(),
                default_labels: Vec::new(),
                concurrency: 32,
                tcp_timeout_ms: 1_000,
                probe_timeout_secs: 15,
                total_targets: 1,
                scanned_targets: 1,
                reachable_count: 1,
                probed_targets: 1,
                identified_count: 1,
                failed_count: 0,
                error: None,
                created_at_ms: 1,
                started_at_ms: Some(1),
                completed_at_ms: Some(2),
            },
            results: vec![result("identified")],
        }
    }

    fn rendered_text(terminal: &Terminal<TestBackend>) -> String {
        let buffer = terminal.backend().buffer();
        (0..buffer.area.height)
            .map(|y| {
                (0..buffer.area.width)
                    .map(|x| buffer[(x, y)].symbol())
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    #[test]
    fn default_connection_names_match_web_discovery_names() {
        assert_eq!(
            default_discovery_connection_name(&result("identified")),
            "cisco_ios-192-0-2-10"
        );
        let mut alternate_port = result("identified");
        alternate_port.port = 2222;
        assert_eq!(
            default_discovery_connection_name(&alternate_port),
            "cisco_ios-192-0-2-10-2222"
        );
    }

    #[test]
    fn selection_excludes_existing_and_imported_results() {
        let identified = result("identified");
        let mut existing = result("identified");
        existing.host = "192.0.2.11".to_string();
        existing.existing_connection_name = Some("edge-11".to_string());
        let mut imported = result("identified");
        imported.host = "192.0.2.12".to_string();
        imported.imported_connection_name = Some("edge-12".to_string());

        assert!(discovery_result_can_import(&identified));
        assert!(!discovery_result_can_import(&existing));
        assert!(!discovery_result_can_import(&imported));
    }

    #[test]
    fn result_search_covers_endpoint_and_detected_facts() {
        let result = result("identified");
        assert!(discovery_result_matches_query(&result, "192.0.2"));
        assert!(discovery_result_matches_query(&result, "9300"));
        assert!(discovery_result_matches_query(&result, "22"));
        assert!(!discovery_result_matches_query(&result, "fortinet"));
    }

    #[test]
    fn narrow_terminal_keeps_endpoint_connection_name_and_quit_action_visible() {
        let backend = TestBackend::new(80, 24);
        let mut terminal = Terminal::new(backend).expect("test terminal");
        let mut app = DiscoveryTui::new(detail(), DiscoveryStatusFilter::All);
        terminal
            .draw(|frame| app.draw(frame))
            .expect("render discovery TUI");

        let output = rendered_text(&terminal);
        assert!(output.contains("192.0.2.10:22"));
        assert!(output.contains("cisco_ios-192-0-2-10"));
        assert!(output.contains("ERROR"));
        assert!(output.contains("[q] quit"));

        let cells = terminal.backend().buffer().content();
        for color in [
            Color::Cyan,
            Color::Green,
            Color::Yellow,
            Color::Blue,
            Color::Magenta,
        ] {
            assert!(
                cells
                    .iter()
                    .any(|cell| cell.fg == color || cell.bg == color),
                "expected the TUI to use {color:?}"
            );
        }
    }
}
