/**
 * M7.6E — BRE Module Index
 *
 * Barrel export for the Business Rules Engine module.
 */

// Core engines
export { FormulaEngine, FormulaParser, FormulaError, tokenize, evaluate, evaluateExpression, validateExpression, extractProviderDependencies, extractVariables, detectCircularDependency, listBuiltInFunctions } from './FormulaEngine';
export type { ASTNode, Token, TokenType, EvaluationContext, FormulaDependency } from './FormulaEngine';

export { FormulaService } from './FormulaService';
export type { FormulaDefinition, CreateFormulaInput, UpdateFormulaInput, FormulaTestResult } from './FormulaService';

export { KPIEngine } from './KPIEngine';
export type { KPIDefinition, CreateKPIInput } from './KPIEngine';

export { RulesEngine } from './RulesEngine';
export type { RuleDefinition, RuleAction, RuleEvaluationResult, CreateRuleInput } from './RulesEngine';

export { AlertEngine } from './AlertEngine';
export type { AlertInstance, AlertComment, CreateAlertInput, AlertFilters, AlertCounts, AlertSeverity, AlertStatus, AlertType } from './AlertEngine';

export { EscalationEngine } from './EscalationEngine';
export type { EscalationChain, EscalationLevel, CreateChainInput } from './EscalationEngine';

// Default rules
export { planningDefaultRules } from './rules/PlanningRules';
export { safetyDefaultRules } from './rules/SafetyRules';
export { executionDefaultRules } from './rules/ExecutionRules';
