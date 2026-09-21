use minijinja::Error;
use minijinja::machinery::{ast, parse};
use std::collections::{BTreeSet, HashSet};

/// Uses the engine's parser, but visits every expression: MiniJinja 2.15's
/// undeclared_variables omits slice operands and several block expressions.
pub(super) fn undeclared_variables(source: &str) -> Result<BTreeSet<String>, Error> {
    let template = parse(source, "<string>", Default::default(), Default::default())?;
    let mut scanner = VariableScanner {
        names: BTreeSet::new(),
        scopes: vec![HashSet::from(["self".to_string()])],
    };
    scanner.statement(&template);
    Ok(scanner.names)
}

struct VariableScanner {
    names: BTreeSet<String>,
    scopes: Vec<HashSet<String>>,
}

impl VariableScanner {
    fn is_local(&self, name: &str) -> bool {
        self.scopes.iter().rev().any(|scope| scope.contains(name))
    }

    fn bind(&mut self, name: &str) {
        self.scopes.last_mut().unwrap().insert(name.to_string());
    }

    fn assign(&mut self, target: &ast::Expr<'_>) {
        match target {
            ast::Expr::Var(var) => self.bind(var.id),
            ast::Expr::List(list) => {
                for item in &list.items {
                    self.assign(item);
                }
            }
            // Namespace attribute assignments need the namespace as input.
            _ => self.expression(target),
        }
    }

    fn body(&mut self, body: &[ast::Stmt<'_>]) {
        for statement in body {
            self.statement(statement);
        }
    }

    fn scoped_body(&mut self, body: &[ast::Stmt<'_>]) {
        self.scopes.push(HashSet::new());
        self.body(body);
        self.scopes.pop();
    }

    fn optional_expression(&mut self, expression: &Option<ast::Expr<'_>>) {
        if let Some(expression) = expression {
            self.expression(expression);
        }
    }

    fn arguments(&mut self, args: &[ast::CallArg<'_>]) {
        for arg in args {
            let (ast::CallArg::Pos(expr)
            | ast::CallArg::Kwarg(_, expr)
            | ast::CallArg::PosSplat(expr)
            | ast::CallArg::KwargSplat(expr)) = arg;
            self.expression(expr);
        }
    }

    fn call(&mut self, call: &ast::Call<'_>) {
        self.expression(&call.expr);
        self.arguments(&call.args);
    }

    fn expression(&mut self, expression: &ast::Expr<'_>) {
        if let Some(path) = attribute_path(expression) {
            if !self.is_local(path.split('.').next().unwrap_or(&path)) {
                self.names.insert(path);
            }
            return;
        }
        match expression {
            ast::Expr::Var(_) | ast::Expr::Const(_) => {}
            ast::Expr::Slice(slice) => {
                self.expression(&slice.expr);
                self.optional_expression(&slice.start);
                self.optional_expression(&slice.stop);
                self.optional_expression(&slice.step);
            }
            ast::Expr::UnaryOp(unary) => self.expression(&unary.expr),
            ast::Expr::BinOp(binary) => {
                self.expression(&binary.left);
                self.expression(&binary.right);
            }
            ast::Expr::IfExpr(conditional) => {
                self.expression(&conditional.test_expr);
                self.expression(&conditional.true_expr);
                self.optional_expression(&conditional.false_expr);
            }
            ast::Expr::Filter(filter) => {
                self.optional_expression(&filter.expr);
                self.arguments(&filter.args);
            }
            ast::Expr::Test(test) => {
                self.expression(&test.expr);
                self.arguments(&test.args);
            }
            ast::Expr::GetAttr(attr) => self.expression(&attr.expr),
            ast::Expr::GetItem(item) => {
                self.expression(&item.expr);
                self.expression(&item.subscript_expr);
            }
            ast::Expr::Call(call) => self.call(call),
            ast::Expr::List(list) => {
                for item in &list.items {
                    self.expression(item);
                }
            }
            ast::Expr::Map(map) => {
                for expression in map.keys.iter().chain(&map.values) {
                    self.expression(expression);
                }
            }
        }
    }

    fn macro_body(&mut self, declaration: &ast::Macro<'_>) {
        self.scopes.push(HashSet::new());
        self.bind("caller");
        for arg in &declaration.args {
            self.assign(arg);
        }
        for default in &declaration.defaults {
            self.expression(default);
        }
        self.body(&declaration.body);
        self.scopes.pop();
    }

    fn statement(&mut self, statement: &ast::Stmt<'_>) {
        match statement {
            ast::Stmt::Template(template) => self.body(&template.children),
            ast::Stmt::EmitExpr(emit) => self.expression(&emit.expr),
            ast::Stmt::EmitRaw(_) => {}
            ast::Stmt::ForLoop(loop_stmt) => {
                self.expression(&loop_stmt.iter);
                self.scopes.push(HashSet::new());
                self.bind("loop");
                self.assign(&loop_stmt.target);
                self.optional_expression(&loop_stmt.filter_expr);
                self.body(&loop_stmt.body);
                self.scopes.pop();
                self.scoped_body(&loop_stmt.else_body);
            }
            ast::Stmt::IfCond(conditional) => {
                self.expression(&conditional.expr);
                // An if statement does not introduce a scope. Only assignments
                // made in both branches are guaranteed to exist afterwards.
                let before = self.scopes.clone();
                self.body(&conditional.true_body);
                let after_true = std::mem::replace(&mut self.scopes, before);
                self.body(&conditional.false_body);
                for (scope, true_scope) in self.scopes.iter_mut().zip(after_true) {
                    scope.retain(|name| true_scope.contains(name));
                }
            }
            ast::Stmt::WithBlock(with) => {
                self.scopes.push(HashSet::new());
                for (target, value) in &with.assignments {
                    self.expression(value);
                    self.assign(target);
                }
                self.body(&with.body);
                self.scopes.pop();
            }
            ast::Stmt::Set(set) => {
                self.expression(&set.expr);
                self.assign(&set.target);
            }
            ast::Stmt::SetBlock(set) => {
                self.body(&set.body);
                self.optional_expression(&set.filter);
                self.assign(&set.target);
            }
            ast::Stmt::AutoEscape(escape) => {
                self.expression(&escape.enabled);
                self.body(&escape.body);
            }
            ast::Stmt::FilterBlock(filter) => {
                self.body(&filter.body);
                self.expression(&filter.filter);
            }
            ast::Stmt::Block(block) => {
                self.scopes.push(HashSet::from(["super".to_string()]));
                self.body(&block.body);
                self.scopes.pop();
            }
            ast::Stmt::Import(import) => {
                self.expression(&import.expr);
                self.assign(&import.name);
            }
            ast::Stmt::FromImport(import) => {
                self.expression(&import.expr);
                for (name, alias) in &import.names {
                    self.assign(alias.as_ref().unwrap_or(name));
                }
            }
            ast::Stmt::Extends(extends) => self.expression(&extends.name),
            ast::Stmt::Include(include) => self.expression(&include.name),
            ast::Stmt::Macro(declaration) => {
                self.bind(declaration.name);
                self.macro_body(declaration);
            }
            ast::Stmt::CallBlock(block) => {
                self.call(&block.call);
                self.macro_body(&block.macro_decl);
            }
            ast::Stmt::Do(statement) => self.call(&statement.call),
        }
    }
}

fn attribute_path(expression: &ast::Expr<'_>) -> Option<String> {
    match expression {
        ast::Expr::Var(var) => Some(var.id.to_string()),
        ast::Expr::GetAttr(attr) => Some(format!("{}.{}", attribute_path(&attr.expr)?, attr.name)),
        ast::Expr::GetItem(item) => {
            let key = item.subscript_expr.as_const()?;
            let key = key.as_str()?;
            Some(format!("{}.{}", attribute_path(&item.expr)?, key))
        }
        _ => None,
    }
}
