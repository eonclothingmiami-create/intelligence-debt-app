import type { BreakEvenModel, LineItem } from '../shared/types.js';
import { priceFromUtility } from '../catalog/model.js';
import { Money } from '@fie/financial-engine';

/**
 * EXAMPLE USER DATASET for tests only — not a product default.
 * Mirrors one company's spreadsheet (Local 311) as if the user entered it.
 */
export function exampleUserDatasetLocal311(): BreakEvenModel {
  const variableCosts: LineItem[] = [
    {
      id: 'v_bolsas_trans',
      label: 'BOLSAS TRANSPARENTES',
      amount: '127',
      category: 'Empaque',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'v_bolsas_envios',
      label: 'BOLSAS ENVIOS',
      amount: '580',
      category: 'Empaque',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'v_pub',
      label: 'COSTO PUBLICIDAD',
      amount: '2400',
      category: 'Marketing',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'v_bolsas_negras',
      label: 'BOLSAS NEGRAS',
      amount: '130',
      category: 'Empaque',
      active: true,
      sortOrder: 3,
    },
    {
      id: 'v_hojas',
      label: 'HOJAS BLOCK',
      amount: '47',
      category: 'Insumos',
      active: true,
      sortOrder: 4,
    },
    {
      id: 'v_termico',
      label: 'PAPEL TERMICO',
      amount: '16',
      category: 'Insumos',
      active: true,
      sortOrder: 5,
    },
    {
      id: 'v_chicle',
      label: 'PAPEL CHICLE',
      amount: '32',
      category: 'Insumos',
      active: true,
      sortOrder: 6,
    },
    { id: 'v_aseo', label: 'ASEO', amount: '16', category: 'Insumos', active: true, sortOrder: 7 },
    {
      id: 'v_stickers',
      label: 'STIKERS',
      amount: '27',
      category: 'Insumos',
      active: true,
      sortOrder: 8,
    },
    {
      id: 'v_flechas',
      label: 'PLASTIFLECHAS',
      amount: '10',
      category: 'Insumos',
      active: true,
      sortOrder: 9,
    },
    {
      id: 'v_domicilios',
      label: 'DOMICILIOS',
      amount: '50',
      category: 'Logística',
      active: true,
      sortOrder: 10,
    },
    {
      id: 'v_marcadores',
      label: 'MARCADORES',
      amount: '13',
      category: 'Insumos',
      active: true,
      sortOrder: 11,
    },
  ];

  const fixedCosts: LineItem[] = [
    {
      id: 'f_arriendo',
      label: 'ARRIENDO',
      amount: '3180000',
      category: 'Local',
      active: true,
      sortOrder: 0,
    },
    {
      id: 'f_serv_local',
      label: 'SERVICIOS LOCAL',
      amount: '450000',
      category: 'Local',
      active: true,
      sortOrder: 1,
    },
    {
      id: 'f_credito',
      label: 'credito',
      amount: '2200000',
      category: 'Deuda',
      kind: 'credit_installment',
      active: true,
      sortOrder: 2,
    },
    {
      id: 'f_nomina',
      label: 'NOMINA CON PROVISION',
      amount: '3000000',
      category: 'Nómina',
      active: true,
      sortOrder: 3,
    },
    {
      id: 'f_contador',
      label: 'CONTADOR',
      amount: '70000',
      category: 'Admin',
      active: true,
      sortOrder: 4,
    },
    {
      id: 'f_supabase',
      label: 'supabase erp',
      amount: '89000',
      category: 'Software',
      active: true,
      sortOrder: 5,
    },
    {
      id: 'f_tigo',
      label: 'TIGO local',
      amount: '135000',
      category: 'Utilidades',
      active: true,
      sortOrder: 6,
    },
    {
      id: 'f_plan',
      label: 'PLAN',
      amount: '104000',
      category: 'Utilidades',
      active: true,
      sortOrder: 7,
    },
    {
      id: 'f_impuestos',
      label: 'IMPUESTOS',
      amount: '380000',
      category: 'Impuestos',
      active: true,
      sortOrder: 8,
    },
    {
      id: 'f_serv_casa',
      label: 'SERVICIOS CASA',
      amount: '180000',
      category: 'Personal',
      active: true,
      sortOrder: 9,
    },
    {
      id: 'f_publicidad',
      label: 'PUBLICIDAD (presupuesto)',
      amount: '2100000',
      category: 'Marketing',
      kind: 'marketing_budget',
      active: true,
      sortOrder: 10,
      notes: 'Planned budget — not actual TikTok charges',
    },
    {
      id: 'f_cuota_casa',
      label: 'CUOTA CASA',
      amount: '500000',
      category: 'Personal',
      active: true,
      sortOrder: 11,
    },
    {
      id: 'f_caja_comp',
      label: 'CAJA COMPENSACION DAVID',
      amount: '405000',
      category: 'Nómina',
      active: true,
      sortOrder: 12,
    },
    {
      id: 'f_comida',
      label: 'COMIDA',
      amount: '1000000',
      category: 'Personal',
      active: true,
      sortOrder: 13,
    },
    {
      id: 'f_gasolina',
      label: 'GASOLINA',
      amount: '250000',
      category: 'Transporte',
      active: true,
      sortOrder: 14,
    },
    {
      id: 'f_moto',
      label: 'MANTENIMIENTO MOTO',
      amount: '100000',
      category: 'Transporte',
      active: true,
      sortOrder: 15,
    },
    {
      id: 'f_ocio',
      label: 'OCIO Y GASTOS PERSONALES',
      amount: '400000',
      category: 'Personal',
      active: true,
      sortOrder: 16,
    },
    {
      id: 'f_parqueadero',
      label: 'PARQUEADERO',
      amount: '75000',
      category: 'Transporte',
      active: true,
      sortOrder: 17,
    },
    {
      id: 'f_brizza',
      label: 'ADMIN BRIZZA',
      amount: '280000',
      category: 'Admin',
      active: true,
      sortOrder: 18,
    },
    {
      id: 'f_somos',
      label: 'SOMOS Internet',
      amount: '65000',
      category: 'Utilidades',
      active: true,
      sortOrder: 19,
    },
    {
      id: 'f_solari',
      label: 'Admón Solari',
      amount: '232000',
      category: 'Admin',
      active: true,
      sortOrder: 20,
    },
  ];

  /** This user's chosen utility-on-price for this dataset (not a global default). */
  const userChosenUtilityOnPrice = '0.5';
  const productCost = Money.from('14000', 'COP');
  const variableTotal = Money.from('3448', 'COP');
  const full = productCost.add(variableTotal);
  const salePrice = priceFromUtility(full, userChosenUtilityOnPrice);

  return {
    currency: 'COP',
    variableCosts,
    fixedCosts,
    products: [
      {
        id: 'producto_1',
        name: 'PRODUCTO 1',
        productCost: '14000',
        salePrice: salePrice.toString(),
        mixWeight: '1',
        active: true,
        sortOrder: 0,
      },
    ],
    /** This user's operating-day preference for this business. */
    operatingDaysPerMonth: 26,
    projectedSales: '36200000',
  };
}

/** @deprecated use exampleUserDatasetLocal311 */
export const local311Model = exampleUserDatasetLocal311;

export const LOCAL311_EXPECTED = {
  variableTotal: '3448',
  fullUnitCost: '17448',
  salePrice: '34896',
  fixedTotal: '15195000',
  breakEvenUnits: '870.87',
  breakEvenSales: '30390000',
  dailyUnits: '33.50',
  dailyMoney: '1168846',
} as const;
