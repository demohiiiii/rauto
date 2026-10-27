use minijinja::Error;
use minijinja::machinery::{ast, parse};
use serde_json::Value;
use std::collections::{BTreeSet, HashSet};

/// Uses the engine's parser, but visits every expression: MiniJinja's built-in
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

/// Scans only the branches that can be reached with the supplied context.
///
/// This is used for diagnostics after a render fails.  The regular scanner is
/// intentionally conservative because it is also used to build the template
/// input schema; that behavior would report variables in inactive branches or
/// values protected by the `default` filter as missing.
pub(super) fn active_undeclared_variables<F>(
    source: &str,
    evaluate: F,
) -> Result<BTreeSet<String>, Error>
where
    F: Fn(&str) -> Option<Value>,
{
    let template = parse(source, "<string>", Default::default(), Default::default())?;
    let mut scanner = VariableScanner {
        names: BTreeSet::new(),
        scopes: vec![HashSet::from(["self".to_string()])],
    };
    scanner.active_statement(&template, source, &evaluate);
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
            ast::Expr::Compare(comparison) => {
                self.expression(&comparison.expr);
                for operand in &comparison.ops {
                    self.expression(&operand.expr);
                }
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

    fn active_body<F>(&mut self, body: &[ast::Stmt<'_>], source: &str, evaluate: &F)
    where
        F: Fn(&str) -> Option<Value>,
    {
        for statement in body {
            self.active_statement(statement, source, evaluate);
        }
    }

    fn active_expression<F>(&mut self, expression: &ast::Expr<'_>, source: &str, evaluate: &F)
    where
        F: Fn(&str) -> Option<Value>,
    {
        self.active_expression_with_default(expression, source, evaluate, false);
    }

    fn active_expression_with_default<F>(
        &mut self,
        expression: &ast::Expr<'_>,
        source: &str,
        evaluate: &F,
        optional: bool,
    ) where
        F: Fn(&str) -> Option<Value>,
    {
        if let Some(path) = attribute_path(expression) {
            if !optional && !self.is_local(path.split('.').next().unwrap_or(&path)) {
                self.names.insert(path);
            }
            return;
        }
        match expression {
            ast::Expr::Var(_) | ast::Expr::Const(_) => {}
            ast::Expr::Slice(slice) => {
                self.active_expression(&slice.expr, source, evaluate);
                self.active_optional_expression(&slice.start, source, evaluate);
                self.active_optional_expression(&slice.stop, source, evaluate);
                self.active_optional_expression(&slice.step, source, evaluate);
            }
            ast::Expr::UnaryOp(unary) => self.active_expression(&unary.expr, source, evaluate),
            ast::Expr::BinOp(binary) => {
                self.active_expression(&binary.left, source, evaluate);
                self.active_expression(&binary.right, source, evaluate);
            }
            ast::Expr::Compare(comparison) => {
                self.active_expression(&comparison.expr, source, evaluate);
                for operand in &comparison.ops {
                    self.active_expression(&operand.expr, source, evaluate);
                }
            }
            ast::Expr::IfExpr(conditional) => {
                self.active_expression(&conditional.test_expr, source, evaluate);
                let branch = expression_source(&conditional.test_expr, source)
                    .and_then(evaluate)
                    .map(|value| value.is_truthy());
                match branch {
                    Some(true) => self.active_expression(&conditional.true_expr, source, evaluate),
                    Some(false) => {
                        if let Some(expr) = &conditional.false_expr {
                            self.active_expression(expr, source, evaluate);
                        }
                    }
                    None => {}
                }
            }
            ast::Expr::Filter(filter) => {
                if filter.name == "default" {
                    if let Some(expr) = &filter.expr {
                        self.active_expression_with_default(expr, source, evaluate, true);
                    }
                } else {
                    self.active_optional_expression(&filter.expr, source, evaluate);
                }
                self.active_arguments(&filter.args, source, evaluate);
            }
            ast::Expr::Test(test) => {
                self.active_expression(&test.expr, source, evaluate);
                self.active_arguments(&test.args, source, evaluate);
            }
            ast::Expr::GetAttr(attr) => self.active_expression(&attr.expr, source, evaluate),
            ast::Expr::GetItem(item) => {
                self.active_expression(&item.expr, source, evaluate);
                self.active_expression(&item.subscript_expr, source, evaluate);
            }
            ast::Expr::Call(call) => {
                self.active_expression(&call.expr, source, evaluate);
                self.active_arguments(&call.args, source, evaluate);
            }
            ast::Expr::List(list) => {
                for item in &list.items {
                    self.active_expression(item, source, evaluate);
                }
            }
            ast::Expr::Map(map) => {
                for expression in map.keys.iter().chain(&map.values) {
                    self.active_expression(expression, source, evaluate);
                }
            }
        }
    }

    fn active_optional_expression<F>(
        &mut self,
        expression: &Option<ast::Expr<'_>>,
        source: &str,
        evaluate: &F,
    ) where
        F: Fn(&str) -> Option<Value>,
    {
        if let Some(expression) = expression {
            self.active_expression(expression, source, evaluate);
        }
    }

    fn active_arguments<F>(&mut self, args: &[ast::CallArg<'_>], source: &str, evaluate: &F)
    where
        F: Fn(&str) -> Option<Value>,
    {
        for arg in args {
            let (ast::CallArg::Pos(expr)
            | ast::CallArg::Kwarg(_, expr)
            | ast::CallArg::PosSplat(expr)
            | ast::CallArg::KwargSplat(expr)) = arg;
            self.active_expression(expr, source, evaluate);
        }
    }

    fn active_statement<F>(&mut self, statement: &ast::Stmt<'_>, source: &str, evaluate: &F)
    where
        F: Fn(&str) -> Option<Value>,
    {
        match statement {
            ast::Stmt::Template(template) => self.active_body(&template.children, source, evaluate),
            ast::Stmt::EmitExpr(emit) => self.active_expression(&emit.expr, source, evaluate),
            ast::Stmt::EmitRaw(_) => {}
            ast::Stmt::ForLoop(loop_stmt) => {
                self.active_expression(&loop_stmt.iter, source, evaluate);
                let iter = expression_source(&loop_stmt.iter, source).and_then(evaluate);
                match iter {
                    Some(Value::Array(items)) if items.is_empty() => {
                        self.active_body(&loop_stmt.else_body, source, evaluate)
                    }
                    Some(Value::Number(number)) if number.as_u64() == Some(0) => {
                        self.active_body(&loop_stmt.else_body, source, evaluate)
                    }
                    Some(Value::Array(_)) | Some(Value::Number(_)) => {
                        self.scopes.push(HashSet::new());
                        self.bind("loop");
                        self.assign(&loop_stmt.target);
                        self.active_optional_expression(&loop_stmt.filter_expr, source, evaluate);
                        self.active_body(&loop_stmt.body, source, evaluate);
                        self.scopes.pop();
                    }
                    Some(_) => {}
                    None => {}
                }
            }
            ast::Stmt::IfCond(conditional) => {
                self.active_expression(&conditional.expr, source, evaluate);
                match expression_source(&conditional.expr, source).and_then(evaluate) {
                    Some(value) if value.is_truthy() => {
                        self.active_body(&conditional.true_body, source, evaluate)
                    }
                    Some(_) => self.active_body(&conditional.false_body, source, evaluate),
                    None => {}
                }
            }
            ast::Stmt::WithBlock(with) => {
                self.scopes.push(HashSet::new());
                for (target, value) in &with.assignments {
                    self.active_expression(value, source, evaluate);
                    self.assign(target);
                }
                self.active_body(&with.body, source, evaluate);
                self.scopes.pop();
            }
            ast::Stmt::Set(set) => {
                self.active_expression(&set.expr, source, evaluate);
                self.assign(&set.target);
            }
            ast::Stmt::SetBlock(set) => {
                self.active_body(&set.body, source, evaluate);
                self.active_optional_expression(&set.filter, source, evaluate);
                self.assign(&set.target);
            }
            ast::Stmt::AutoEscape(escape) => {
                self.active_expression(&escape.enabled, source, evaluate);
                self.active_body(&escape.body, source, evaluate);
            }
            ast::Stmt::FilterBlock(filter) => {
                self.active_body(&filter.body, source, evaluate);
                self.active_expression(&filter.filter, source, evaluate);
            }
            ast::Stmt::Block(block) => {
                self.scopes.push(HashSet::from(["super".to_string()]));
                self.active_body(&block.body, source, evaluate);
                self.scopes.pop();
            }
            ast::Stmt::Import(import) => {
                self.active_expression(&import.expr, source, evaluate);
                self.assign(&import.name);
            }
            ast::Stmt::FromImport(import) => {
                self.active_expression(&import.expr, source, evaluate);
                for (name, alias) in &import.names {
                    self.assign(alias.as_ref().unwrap_or(name));
                }
            }
            ast::Stmt::Extends(extends) => self.active_expression(&extends.name, source, evaluate),
            ast::Stmt::Include(include) => self.active_expression(&include.name, source, evaluate),
            ast::Stmt::Macro(declaration) => {
                self.bind(declaration.name);
                self.macro_body(declaration);
            }
            ast::Stmt::CallBlock(block) => {
                self.active_expression(&block.call.expr, source, evaluate);
                self.active_arguments(&block.call.args, source, evaluate);
                self.macro_body(&block.macro_decl);
            }
            ast::Stmt::Do(statement) => {
                self.active_expression(&statement.call.expr, source, evaluate);
                self.active_arguments(&statement.call.args, source, evaluate);
            }
        }
    }
}

fn expression_source<'a>(expression: &ast::Expr<'_>, source: &'a str) -> Option<&'a str> {
    let span = expression.span();
    source.get(span.start_offset as usize..span.end_offset as usize)
}

trait JsonValueTruthiness {
    fn is_truthy(&self) -> bool;
}

impl JsonValueTruthiness for Value {
    fn is_truthy(&self) -> bool {
        match self {
            Value::Null => false,
            Value::Bool(value) => *value,
            Value::Number(value) => value.as_f64().is_some_and(|value| value != 0.0),
            Value::String(value) => !value.is_empty(),
            Value::Array(value) => !value.is_empty(),
            Value::Object(value) => !value.is_empty(),
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
