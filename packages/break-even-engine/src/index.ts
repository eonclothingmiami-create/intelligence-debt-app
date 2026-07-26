export { computeBreakEven } from './compute/breakEven.js';
export {
  sumVariableCostsPerUnit,
  sumFixedCosts,
  averageUnitEconomics,
  priceFromUtility,
  upsertLineItem,
  upsertProduct,
  setLineActive,
  reorderLineItems,
} from './catalog/model.js';
export {
  amountAsOf,
  compareIsoDate,
  isIsoDate,
  monthStartIso,
  projectFixedCostsAsOf,
  projectModelAsOf,
  sortSegments,
} from './catalog/versions.js';
export type {
  CostAmountSegment,
  ProjectFixedCostsAsOfResult,
  ProjectModelAsOfResult,
} from './catalog/versions.js';
export { applyPatch, simulateWhatIf } from './simulate/whatIf.js';
export type { ModelPatch, WhatIfScenario } from './simulate/whatIf.js';
export {
  exampleUserDatasetLocal311,
  local311Model,
  LOCAL311_EXPECTED,
} from './fixtures/local311.js';
export { FORMULA_VERSION } from './shared/types.js';
export type {
  LineItem,
  Product,
  BreakEvenModel,
  BreakEvenSnapshot,
  PeriodBreakdown,
} from './shared/types.js';
export {
  COLOMBIA_SMMLV_BY_YEAR,
  COLOMBIA_ARL_CLASS_RATES,
  colombiaSmmlvForYear,
  computeColombiaEmployerPayroll,
  payrollOneSmmlvWorker,
} from './payroll/colombia.js';
export type {
  ColombiaSmmlvYear,
  ColombiaPayrollInput,
  ColombiaPayrollBreakdown,
} from './payroll/colombia.js';
