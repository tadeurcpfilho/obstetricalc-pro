import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Baby,
  Stethoscope,
  FlaskConical,
  Milestone,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  Clock,
  ChevronRight,
  ShieldAlert,
  Syringe,
  FileText,
  Scale,
  HeartPulse,
  Activity,
  HelpCircle,
  Search
} from 'lucide-react';

// --- FUNÇÕES UTILITÁRIAS DE DATAS (HORÁRIO LOCAL S/ FUSO) ---
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d, 12, 0, 0); // Meio-dia evita bugs de horário de verão
};

const formatInputDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatBRDate = (date) => {
  if (!date || isNaN(date.getTime())) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const formatShortBRDate = (date) => {
  if (!date || isNaN(date.getTime())) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
};

const addDays = (date, days) => {
  if (!date || isNaN(date.getTime())) return null;
  const res = new Date(date.getTime());
  res.setDate(res.getDate() + Math.round(days));
  return res;
};

const diffInDays = (dateA, dateB) => {
  if (!dateA || !dateB) return null;
  const utcA = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  const utcB = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
  return Math.round((utcA - utcB) / (1000 * 60 * 60 * 24));
};

const daysToIG = (totalDays) => {
  if (totalDays === null || totalDays === undefined || isNaN(totalDays)) return null;
  const negative = totalDays < 0;
  const absDays = Math.abs(totalDays);
  const weeks = Math.floor(absDays / 7);
  const days = absDays % 7;
  return {
    totalDays,
    weeks: negative ? -weeks : weeks,
    days: negative ? -days : days,
    formatted: negative ? `-${weeks}s ${days}d` : `${weeks}s ${days}d`,
    fullFormatted: negative
      ? `${weeks} sem e ${days} d (pré-DUM)`
      : `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} e ${days} ${days === 1 ? 'dia' : 'dias'}`
  };
};

// Critérios ACOG / FEBRASGO de Redatação por US
const getRedatingLimitDays = (usTotalDays) => {
  if (usTotalDays <= 62) { // Até 8s 6d
    return { maxDiff: 5, label: 'Até 8s 6d (1º Tri Precoce)', ruleText: '> 5 dias de discrepância' };
  } else if (usTotalDays <= 97) { // 9s 0d a 13s 6d
    return { maxDiff: 7, label: '9s 0d a 13s 6d (1º Trimestre)', ruleText: '> 7 dias de discrepância' };
  } else if (usTotalDays <= 111) { // 14s 0d a 15s 6d
    return { maxDiff: 7, label: '14s 0d a 15s 6d (2º Tri Inicial)', ruleText: '> 7 dias de discrepância' };
  } else if (usTotalDays <= 153) { // 16s 0d a 21s 6d
    return { maxDiff: 10, label: '16s 0d a 21s 6d (2º Trimestre)', ruleText: '> 10 dias de discrepância' };
  } else if (usTotalDays <= 195) { // 22s 0d a 27s 6d
    return { maxDiff: 14, label: '22s 0d a 27s 6d (2º Tri Tardio)', ruleText: '> 14 dias de discrepância' };
  } else { // >= 28s 0d
    return { maxDiff: 21, label: '≥ 28s 0d (3º Trimestre)', ruleText: '> 21 dias de discrepância (cautela: risco de RCIU/Macrossomia)' };
  }
};

export default function App() {
  // Data atual padrão do sistema
  const todayStr = useMemo(() => formatInputDate(new Date()), []);

  // --- ESTADOS DE ENTRADA ---
  const [refDateStr, setRefDateStr] = useState(todayStr);
  const [dumStr, setDumStr] = useState('');
  const [dumIncerta, setDumIncerta] = useState(false);

  // Ultrassom Prévio
  const [usDateStr, setUsDateStr] = useState('');
  const [usWeeks, setUsWeeks] = useState('');
  const [usDays, setUsDays] = useState('');

  // Método de escolha para IG Definitiva: 'auto' | 'dum' | 'us'
  const [methodOverride, setMethodOverride] = useState('auto');

  // Aba ativa
  const [activeTab, setActiveTab] = useState('ultrassom');

  // Fator Rh e Particularidades para personalizar alertas nos exames
  const [isRhNegativo, setIsRhNegativo] = useState(false);
  const [toxoSuscetivel, setToxoSuscetivel] = useState(true);

  // Estado dos checklists de exames laboratoriais e ultrassom
  const [checkedItems, setCheckedItems] = useState({});
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Carregar exemplo clínico inicial para não abrir a tela vazia
  useEffect(() => {
    loadClinicalExample('redatar_1tri');
  }, []);

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- EXEMPLOS CLÍNICOS PRÉ-CONFIGURADOS ---
  const loadClinicalExample = (type) => {
    const ref = parseLocalDate(refDateStr) || new Date();
    if (type === 'redatar_1tri') {
      // Gestante hoje com ~25s pela DUM, mas US de 12s deu 10 dias de diferença (Redata para US)
      const simDum = addDays(ref, -176); // 25s 1d
      const simUsDate = addDays(simDum, 94); // Na época 13s 3d pela DUM
      setDumStr(formatInputDate(simDum));
      setDumIncerta(false);
      setUsDateStr(formatInputDate(simUsDate));
      setUsWeeks('12'); // 12s 0d no US -> 10 dias de discrepância (> 7d)
      setUsDays('0');
      setMethodOverride('auto');
    } else if (type === 'manter_dum') {
      // Gestante com DUM e US de 8 semanas compatíveis (diferença de 3 dias -> Mantém DUM)
      const simDum = addDays(ref, -115); // 16s 3d
      const simUsDate = addDays(simDum, 59); // 8s 3d pela DUM
      setDumStr(formatInputDate(simDum));
      setDumIncerta(false);
      setUsDateStr(formatInputDate(simUsDate));
      setUsWeeks('8'); // 8s 0d no US -> 3 dias de discrepância (<= 5d)
      setUsDays('0');
      setMethodOverride('auto');
    } else if (type === 'terceiro_tri') {
      // Gestante no 3º trimestre (35 semanas) com DUM incerta, datada por US precoce
      const simDumFicticia = addDays(ref, -247); // 35s 2d
      const simUsDate = addDays(simDumFicticia, 52); // Feito com 7s 3d
      setDumStr('');
      setDumIncerta(true);
      setUsDateStr(formatInputDate(simUsDate));
      setUsWeeks('7');
      setUsDays('3');
      setMethodOverride('auto');
    }
  };

  const clearAll = () => {
    setDumStr('');
    setDumIncerta(false);
    setUsDateStr('');
    setUsWeeks('');
    setUsDays('');
    setMethodOverride('auto');
  };

  // --- MOTOR DE CÁLCULO OBSTÉTRICO ---
  const calc = useMemo(() => {
    const refDate = parseLocalDate(refDateStr);
    const dumDate = !dumIncerta ? parseLocalDate(dumStr) : null;
    const usDate = parseLocalDate(usDateStr);
    const parsedUsW = usWeeks !== '' ? parseInt(usWeeks, 10) : null;
    const parsedUsD = usDays !== '' ? parseInt(usDays, 10) : 0;

    const hasValidDum = Boolean(dumDate && refDate);
    const hasValidUs = Boolean(
      usDate &&
      refDate &&
      parsedUsW !== null &&
      !isNaN(parsedUsW) &&
      parsedUsW >= 0 &&
      parsedUsW <= 44 &&
      !isNaN(parsedUsD) &&
      parsedUsD >= 0 &&
      parsedUsD <= 6
    );

    // 1. Dados pela DUM
    let dumData = null;
    if (hasValidDum) {
      const totalDaysAtRef = diffInDays(refDate, dumDate);
      const dpp = addDays(dumDate, 280);
      dumData = {
        effectiveDum: dumDate,
        dpp,
        igAtRef: daysToIG(totalDaysAtRef),
        conceptionDate: addDays(dumDate, 14)
      };
    }

    // 2. Dados pelo Ultrassom
    let usData = null;
    if (hasValidUs) {
      const usTotalDaysAtExam = parsedUsW * 7 + parsedUsD;
      const pseudoDum = addDays(usDate, -usTotalDaysAtExam);
      const totalDaysAtRef = diffInDays(refDate, pseudoDum);
      const dpp = addDays(pseudoDum, 280);
      usData = {
        examDate: usDate,
        igAtExam: daysToIG(usTotalDaysAtExam),
        effectiveDum: pseudoDum,
        dpp,
        igAtRef: daysToIG(totalDaysAtRef),
        conceptionDate: addDays(pseudoDum, 14)
      };
    }

    // 3. Algoritmo de Comparação e Redatação (ACOG / FEBRASGO)
    let redatingVerdict = null;
    if (hasValidDum && hasValidUs) {
      const igDumAtUsExamDays = diffInDays(usDate, dumDate);
      const igUsAtExamDays = usData.igAtExam.totalDays;
      const discrepancyDays = Math.abs(igDumAtUsExamDays - igUsAtExamDays);
      const signedDiscrepancy = igUsAtExamDays - igDumAtUsExamDays; // + se US maior que DUM
      const criterion = getRedatingLimitDays(igUsAtExamDays);
      const shouldRedate = discrepancyDays > criterion.maxDiff;

      redatingVerdict = {
        igDumAtExam: daysToIG(igDumAtUsExamDays),
        igUsAtExam: usData.igAtExam,
        discrepancyDays,
        signedDiscrepancy,
        criterion,
        shouldRedate,
        recommendedSource: shouldRedate ? 'us' : 'dum',
        explanation: shouldRedate
          ? `Discrepância de ${discrepancyDays} dias supera o limite de ${criterion.maxDiff} dias para US realizado em ${criterion.label}. Recomenda-se REDATAR pelo Ultrassom.`
          : `Discrepância de ${discrepancyDays} ${discrepancyDays === 1 ? 'dia' : 'dias'} está dentro da margem aceitável (até ${criterion.maxDiff} dias) para ${criterion.label}. Recomenda-se MANTER A DUM.`
      };
    }

    // 4. Definição da IG Definitiva / Oficial
    let activeSource = null; // 'dum' | 'us'
    if (methodOverride === 'dum' && hasValidDum) {
      activeSource = 'dum';
    } else if (methodOverride === 'us' && hasValidUs) {
      activeSource = 'us';
    } else {
      // Modo Automático
      if (hasValidDum && hasValidUs) {
        activeSource = redatingVerdict.recommendedSource;
      } else if (hasValidDum) {
        activeSource = 'dum';
      } else if (hasValidUs) {
        activeSource = 'us';
      }
    }

    const finalData = activeSource === 'dum' ? dumData : activeSource === 'us' ? usData : null;

    // 5. Métricas Derivadas da IG Definitiva
    let clinicalMetrics = null;
    if (finalData && finalData.igAtRef) {
      const days = finalData.igAtRef.totalDays;
      const weeks = finalData.igAtRef.weeks;
      const progressPct = Math.min(100, Math.max(0, Math.round((days / 280) * 100)));
      const remainingDays = 280 - days;

      let trimester = '1º Trimestre';
      let trimesterBadge = 'bg-teal-100 text-teal-800 border-teal-200';
      if (days >= 98 && days <= 195) {
        trimester = '2º Trimestre';
        trimesterBadge = 'bg-indigo-100 text-indigo-800 border-indigo-200';
      } else if (days >= 196) {
        trimester = '3º Trimestre';
        trimesterBadge = 'bg-purple-100 text-purple-800 border-purple-200';
      }

      // Classificação da Idade Gestacional no Termo
      let termClassification = 'Pré-termo (< 37 semanas)';
      if (days < 140) termClassification = 'Primeira metade da gestação (< 20s)';
      else if (days < 238) termClassification = 'Pré-termo precoce / intermediário (20s a 33s6d)';
      else if (days >= 238 && days <= 258) termClassification = 'Pré-termo Tardio (34s 0d a 36s 6d)';
      else if (days >= 259 && days <= 272) termClassification = 'Termo Precoce (37s 0d a 38s 6d)';
      else if (days >= 273 && days <= 286) termClassification = 'Termo Completo (39s 0d a 40s 6d)';
      else if (days >= 287 && days <= 293) termClassification = 'Termo Tardio (41s 0d a 41s 6d)';
      else if (days >= 294) termClassification = 'Pós-Termo (≥ 42s 0d)';

      clinicalMetrics = {
        progressPct,
        remainingDays,
        trimester,
        trimesterBadge,
        termClassification,
        weeks
      };
    }

    return {
      refDate,
      hasValidDum,
      hasValidUs,
      dumData,
      usData,
      redatingVerdict,
      activeSource,
      finalData,
      clinicalMetrics
    };
  }, [refDateStr, dumStr, dumIncerta, usDateStr, usWeeks, usDays, methodOverride]);

  // Função auxiliar para calcular janela de datas a partir da DUM Efetiva
  const getWindowStatus = (startDays, endDays) => {
    if (!calc.finalData || !calc.refDate) return null;
    const baseDum = calc.finalData.effectiveDum;
    const startDate = addDays(baseDum, startDays);
    const endDate = addDays(baseDum, endDays);
    const currentDays = calc.finalData.igAtRef.totalDays;

    let status = 'future'; // 'past' | 'current' | 'soon' | 'future'
    let statusLabel = '';
    let daysDiff = 0;

    if (currentDays > endDays) {
      status = 'past';
      daysDiff = currentDays - endDays;
      statusLabel = `Janela encerrada há ${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'}`;
    } else if (currentDays >= startDays && currentDays <= endDays) {
      status = 'current';
      daysDiff = endDays - currentDays;
      statusLabel = `JANELA ATUAL • Restam ${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'}`;
    } else {
      daysDiff = startDays - currentDays;
      if (daysDiff <= 14) {
        status = 'soon';
        statusLabel = `Próximo • Inicia em ${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'}`;
      } else {
        status = 'future';
        statusLabel = `Futuro • Inicia em ${daysDiff} dias`;
      }
    }

    return {
      startDate,
      endDate,
      startFormatted: formatBRDate(startDate),
      endFormatted: formatBRDate(endDate),
      status,
      statusLabel,
      daysDiff
    };
  };

  // --- DADOS ESTRUTURADOS: CRONOGRAMA DE ULTRASSONOGRAFIAS ---
  const ultrasoundSchedule = useMemo(() => {
    if (!calc.finalData) return [];
    return [
      {
        id: 'us_1_transvaginal',
        title: 'US Obstétrico Transvaginal Inicial (Datação e Viabilidade)',
        igRangeLabel: '6s 0d a 9s 6d (Ideal: 7s a 8s)',
        startDays: 6 * 7,
        endDays: 9 * 7 + 6,
        priority: 'Essencial',
        objectives: [
          'Confirmar gestação tópica intrauterina e excluir ectópica',
          'Avaliar Saco Gestacional (SG), Vesícula Vitelínica (VV) e Embrião (CCN)',
          'Documentar Batimentos Cardíacos Fetais (BCF - visível se CCN ≥ 7 mm)',
          'Determinar número de embriões, corionicidade e amnionicidade em gemelares',
          'Padrão-ouro para datação precoce da gestação pelo CCN'
        ],
        window: getWindowStatus(6 * 7, 9 * 7 + 6)
      },
      {
        id: 'us_2_morf1',
        title: 'US Morfológico de 1º Trimestre + Doppler de Artérias Uterinas',
        igRangeLabel: '11s 0d a 13s 6d (CCN 45 a 84 mm)',
        startDays: 11 * 7,
        endDays: 13 * 7 + 6,
        priority: 'Crítico / Janela Rígida',
        objectives: [
          'Medida da Translucência Nucal (TN) para rastreio de aneuploidias (T21, T18, T13)',
          'Avaliação do Osso Nasal, Ducto Venoso e Regurgitação Tricúspide',
          'Rastreio de Pré-Eclâmpsia precoce (Doppler de Artérias Uterinas - IP médio)',
          'Se alto risco para Pré-Eclâmpsia: iniciar AAS 100-150mg/noite antes de 16 semanas',
          'Revisão anatômica precoce de calota craniana, parede abdominal e membros'
        ],
        window: getWindowStatus(11 * 7, 13 * 7 + 6)
      },
      {
        id: 'us_3_colo',
        title: 'Avaliação Ultrassonográfica do Colo Uterino (Via Transvaginal)',
        igRangeLabel: '16s 0d a 24s 0d',
        startDays: 16 * 7,
        endDays: 24 * 7,
        priority: 'Rastreio Universal',
        objectives: [
          'Rastreio universal de prematuridade espontânea e incompetência istmocervical',
          'Em pacientes com perda gestacional de 2º tri ou parto prematuro prévio: iniciar seriado às 16s',
          'Em gestantes de baixo risco: realizar obrigatoriamente junto ao Morfológico de 2º Tri (20-24s)',
          'Ponto de corte: Colo curto ≤ 25 mm indica progesterona micronizada vaginal (200mg/noite)'
        ],
        window: getWindowStatus(16 * 7, 24 * 7)
      },
      {
        id: 'us_4_morf2',
        title: 'US Morfológico de 2º Trimestre + Medida Cervical + Doppler',
        igRangeLabel: '20s 0d a 24s 0d (Ideal: 21s a 23s)',
        startDays: 20 * 7,
        endDays: 24 * 7,
        priority: 'Crítico',
        objectives: [
          'Estudo detalhado da anatomia fetal (SNC, face, coração 4 câmaras e vias de saída, coluna, rins, membros)',
          'Biometria fetal completa e estimativa de percentil de peso (Curva Hadlock/Intergrowth)',
          'Localização placentária (rastreio de placenta prévia / acretismo) e inserção do cordão',
          'Medida do comprimento do colo uterino transvaginal e Doppler das artérias uterinas'
        ],
        window: getWindowStatus(20 * 7, 24 * 7)
      },
      {
        id: 'us_5_ecocardio',
        title: 'Ecocardiograma Fetal com Mapeamento de Fluxo em Cores',
        igRangeLabel: '24s 0d a 28s 0d',
        startDays: 24 * 7,
        endDays: 28 * 7,
        priority: 'Recomendado / Seletivo',
        objectives: [
          'Avaliação anatômica e hemodinâmica específica das câmaras cardíacas, septos e arcos ductal/aórtico',
          'Indicação formal: DM prévio ou DMG precoce, cardiopatia congênita familiar, TN ≥ p95, FIV, idade materna ≥ 35a ou uso de teratogênicos',
          'Solicitado rotineiramente na rede suplementar como triagem neonatal precoce de cardiopatias críticas'
        ],
        window: getWindowStatus(24 * 7, 28 * 7)
      },
      {
        id: 'us_6_crescimento1',
        title: 'US Obstétrico de 3º Trimestre - Fase 1 (Crescimento Inicial)',
        igRangeLabel: '28s 0d a 32s 0d',
        startDays: 28 * 7,
        endDays: 32 * 7,
        priority: 'Rotina 3º Tri',
        objectives: [
          'Avaliação da curva de crescimento fetal (detecção de RCIU precoce ou Macrossomia no DMG)',
          'Quantificação do líquido amniótico (ILA ou Maior Bolsão Vertical - MBV)',
          'Reavaliação de placentas baixas diagnosticadas no 2º trimestre',
          'Dopplervelocimetria obstétrica (Umbilical e Cerebral Média) se hipertensão, DMG ou percentil < 10'
        ],
        window: getWindowStatus(28 * 7, 32 * 7)
      },
      {
        id: 'us_7_crescimento2',
        title: 'US Obstétrico de 3º Trimestre - Fase 2 (Pré-Termo Tardio / Termo)',
        igRangeLabel: '34s 0d a 37s 0d',
        startDays: 34 * 7,
        endDays: 37 * 7,
        priority: 'Planejamento do Parto',
        objectives: [
          'Confirmação da apresentação fetal (cefálica, pélvica ou córmica) para planejamento da via de parto',
          'Detecção de RCIU tardio (avaliar relação cérebro-placentária - RCP)',
          'Estimativa de peso fetal próximo ao termo e vitalidade (Perfil Biofísico Fetal se indicado)',
          'Avaliação do volume de líquido amniótico (oligodramnia / polidramnia)'
        ],
        window: getWindowStatus(34 * 7, 37 * 7)
      }
    ];
  }, [calc.finalData, calc.refDate]);

  // --- DADOS ESTRUTURADOS: EXAMES LABORATORIAIS POR TRIMESTRE ---
  const labPanels = useMemo(() => {
    if (!calc.finalData) return [];
    return [
      {
        id: 'lab_1tri',
        title: 'Rotina de 1º Trimestre (1ª Consulta / Captação Precoce)',
        igRangeLabel: 'Até 12s 6d (ou imediato na 1ª consulta)',
        startDays: 4 * 7,
        endDays: 12 * 7 + 6,
        badgeColor: 'teal',
        window: getWindowStatus(4 * 7, 12 * 7 + 6),
        clinicalNotes: 'Jejum de 8-12h para glicemia. Se Glicemia de Jejum ≥ 92 e < 126 mg/dL, já fecha diagnóstico de Diabetes Mellitus Gestacional (DMG). Se ≥ 126 mg/dL, DM franco (pré-gestacional).',
        exams: [
          { id: 'l1_abo', name: 'Tipagem Sanguínea ABO e Fator Rh', detail: isRhNegativo ? '⚠️ Gestante Rh Negativo: solicitar Coombs Indireto basal' : 'Solicitar Coombs Indireto se Rh negativo' },
          { id: 'l1_hm', name: 'Hemograma Completo + Plaquetas', detail: 'Rastreio de anemia (Hb < 11 g/dL no 1º tri) e plaquetopenia' },
          { id: 'l1_glic', name: 'Glicemia de Jejum', detail: 'Normal < 92 mg/dL | DMG: 92 a 125 mg/dL | DM Franco: ≥ 126 mg/dL' },
          { id: 'l1_tsh', name: 'TSH e T4 Livre', detail: 'Rastreio de hipotireoidismo clínico/subclínico (avaliar anti-TPO se TSH > 2,5)' },
          { id: 'l1_vdrl', name: 'Teste Rápido de Sífilis e/ou VDRL quantitativo', detail: 'Tratar imediatamente com Penicilina Benzatina se reagente' },
          { id: 'l1_hiv', name: 'Sorologia Anti-HIV I e II (ou Teste Rápido)', detail: 'Obrigatório no 1º e 3º trimestres' },
          { id: 'l1_hepb', name: 'Hepatite B (HBsAg e Anti-HBs)', detail: 'Se ambos não reagentes, indicar vacinação para Hepatite B' },
          { id: 'l1_hepc', name: 'Hepatite C (Anti-HCV)', detail: 'Rastreio universal recomendado pelo MS/FEBRASGO' },
          { id: 'l1_toxo', name: 'Toxoplasmose IgG e IgM', detail: toxoSuscetivel ? '⚠️ Suscetível (IgG-/IgM-): orientar profilaxia alimentar e repetir a cada 1-2 meses' : 'Se IgG+ e IgM+ até 16s: solicitar Teste de Avidez de IgG' },
          { id: 'l1_cmv_rub', name: 'Rubéola (IgG/IgM) e Citomegalovírus (IgG/IgM)', detail: 'Complementar conforme protocolo assistencial / suplementar' },
          { id: 'l1_urina', name: 'Sumário de Urina (EAS) + Urocultura com Antibiograma', detail: 'Rastreio de bacteriúria assintomática (≥ 10⁵ UFC/mL deve ser tratada)' },
          { id: 'l1_eletro', name: 'Eletroforese de Hemoglobina', detail: 'Rastreio de anemia falciforme e talassemias (MS)' },
          { id: 'l1_ferr_vitd', name: 'Ferritina Sérica e 25-OH-Vitamina D', detail: 'Avaliação de reservas maternas de ferro e status de vitamina D' },
          { id: 'l1_citologia', name: 'Citologia Oncótica Cervical (Papanicolaou)', detail: 'Colher se estiver em atraso (usar espátula de Ayre, evitar canal endocervical profundo se risco)' }
        ]
      },
      {
        id: 'lab_2tri_inicial',
        title: 'Seguimento Intermediário de 2º Trimestre (Se Suscetível / Rh-)',
        igRangeLabel: '16s 0d a 20s 0d',
        startDays: 16 * 7,
        endDays: 20 * 7,
        badgeColor: 'indigo',
        window: getWindowStatus(16 * 7, 20 * 7),
        clinicalNotes: 'Painel enxuto focado na vigilância de soroconversão para toxoplasmose, aloimunização Rh e infecção urinária.',
        exams: [
          { id: 'l2i_toxo', name: 'Toxoplasmose IgG e IgM (Controle)', detail: toxoSuscetivel ? 'Obrigatório pois paciente marcada como Suscetível' : 'Dispensável se paciente já possui IgG reagente prévio (imune)' },
          { id: 'l2i_coombs', name: 'Coombs Indireto (Pesquisa de Anticorpos Irregulares)', detail: isRhNegativo ? '⚠️ Obrigatório mensalmente (Gestante Rh Negativo com parceiro Rh Positivo/desconhecido)' : 'Apenas se gestante Rh Negativo' },
          { id: 'l2i_uro', name: 'Urocultura de Controle (se histórico de ITU/Bacteriúria)', detail: 'Obrigatório mensal se episódio prévio de ITU na gestação' }
        ]
      },
      {
        id: 'lab_2tri_totg',
        title: 'Rotina de 2º Trimestre + Rastreio de DMG (Janela do TOTG 75g)',
        igRangeLabel: '24s 0d a 28s 0d',
        startDays: 24 * 7,
        endDays: 28 * 7,
        badgeColor: 'amber',
        window: getWindowStatus(24 * 7, 28 * 7),
        clinicalNotes: 'Janela metabólica de pico dos hormônios contrainsulínicos placentários (lactogênio placentário). TOTG 75g é contraindicado se paciente já tiver diagnóstico prévio de DMG no 1º tri ou cirurgia bariátrica (usar monitorização capilar).',
        exams: [
          { id: 'l2_totg', name: 'TOTG 75g (Curva Glicêmica: Jejum, 1h e 2h)', detail: 'Alterado (DMG) se ≥ 1 valor atingido: Jejum ≥ 92 | 1h ≥ 180 | 2h ≥ 153 mg/dL' },
          { id: 'l2_hm', name: 'Hemograma Completo + Ferritina', detail: 'No 2º tri tolera-se hemodiluição fisiológica até Hb ≥ 10,5 g/dL' },
          { id: 'l2_coombs', name: 'Coombs Indireto (Pré-Imunoglobulina Anti-D)', detail: isRhNegativo ? '⚠️ Colher antes de administrar Imunoglobulina Anti-D às 28 semanas' : 'Apenas para gestantes Rh negativo (para indicar Rhogan às 28s)' },
          { id: 'l2_sorologias', name: 'VDRL, Anti-HIV e HBsAg (Repetição de 2º Tri)', detail: 'Recomendado em populações de maior vulnerabilidade ou protocolo municipal' },
          { id: 'l2_toxo', name: 'Toxoplasmose IgG e IgM', detail: toxoSuscetivel ? 'Manter rastreio bimestral/mensal nas suscetíveis' : 'Dispensado se imune' },
          { id: 'l2_urina', name: 'Sumário de Urina (EAS) + Urocultura com Antibiograma', detail: 'Rastreio de ITU de 2º trimestre' }
        ]
      },
      {
        id: 'lab_3tri',
        title: 'Rotina Laboratorial de 3º Trimestre (Pré-Parto / Admissão)',
        igRangeLabel: '32s 0d a 36s 0d',
        startDays: 32 * 7,
        endDays: 36 * 7,
        badgeColor: 'purple',
        window: getWindowStatus(32 * 7, 36 * 7),
        clinicalNotes: 'Resultados devem estar anotados na Caderneta da Gestante para apresentação na maternidade no momento do parto.',
        exams: [
          { id: 'l3_hm', name: 'Hemograma Completo + Coagulograma (se indicação)', detail: 'Corrigir anemia antes do parto (meta Hb ≥ 11,0 g/dL no 3º tri)' },
          { id: 'l3_vdrl', name: 'VDRL Quantitativo (Obrigatório 3º Tri)', detail: 'Exigido na admissão da maternidade para prevenção de sífilis congênita' },
          { id: 'l3_hiv', name: 'Sorologia Anti-HIV I e II (Obrigatório 3º Tri)', detail: 'Definir profilaxia intraparto e manejo do RN' },
          { id: 'l3_hepb', name: 'HBsAg (Hepatite B - 3º Tri)', detail: 'Definir necessidade de imunoglobulina (IGHAHB) ao RN nas primeiras 12h' },
          { id: 'l3_toxo', name: 'Toxoplasmose IgG e IgM', detail: toxoSuscetivel ? 'Última checagem pré-parto nas gestantes suscetíveis' : 'Dispensado se imune' },
          { id: 'l3_urina', name: 'Sumário de Urina (EAS) + Urocultura', detail: 'Evitar pielonefrite e sepse neonatal no periparto' }
        ]
      },
      {
        id: 'lab_egb',
        title: 'Rastreio de Estreptococo do Grupo B (Swab EGB / GBS)',
        igRangeLabel: '35s 0d a 37s 0d',
        startDays: 35 * 7,
        endDays: 37 * 7,
        badgeColor: 'rose',
        window: getWindowStatus(35 * 7, 37 * 7),
        clinicalNotes: 'Validade da cultura é de 5 semanas. Dispensado de colher swab se a gestante já teve Urocultura positiva para Streptococcus agalactiae (EGB) em qualquer momento desta gestação ou filho anterior com sepse neonatal por EGB (já têm indicação direta de profilaxia intraparto).',
        exams: [
          { id: 'l3_swab_egb', name: 'Cultura para Estreptococo do Grupo B (Swab Vaginal Introito + Retal)', detail: 'Meio seletivo Todd-Hewitt. Se positivo: Penicilina Cristalina IV intraparto (Exceto na cesárea eletiva fora de TP e com bolsa íntegra)' }
        ]
      }
    ];
  }, [calc.finalData, calc.refDate, isRhNegativo, toxoSuscetivel]);

  // --- DADOS ESTRUTURADOS: MARCOS DA GRAVIDEZ E VACINAS ---
  const pregnancyMilestones = useMemo(() => {
    if (!calc.finalData) return [];
    const baseDum = calc.finalData.effectiveDum;
    const currentDays = calc.finalData.igAtRef.totalDays;

    const rawMilestones = [
      {
        id: 'm_concepcao',
        igLabel: '2s 0d',
        days: 14,
        title: 'Concepção / Ovulação Estimada',
        category: 'Fisiologia',
        desc: 'Fecundação estimada (~14 dias após o 1º dia da DUM efetiva). Nidação ocorre entre 6 a 10 dias após a fecundação.'
      },
      {
        id: 'm_embriogenese',
        igLabel: '10s 0d',
        days: 70,
        title: 'Fim do Período Embrionário / Início do Período Fetal',
        category: 'Desenvolvimento',
        desc: 'Organogênese principal concluída. A partir de 10 semanas completas o concepto passa a ser denominado feto. Redução expressiva do risco de malformações estruturais maiores por teratogênicos.'
      },
      {
        id: 'm_nipt',
        igLabel: '10s 0d a 13s 6d',
        days: 70,
        endDays: 97,
        title: 'Janela para NIPT (DNA Fetal Livre no Sangue Materno) e Morfológico 1º Tri',
        category: 'Rastreio Genético',
        desc: 'A partir de 10s a fração fetal permite sexagem fetal e NIPT. Entre 11s e 13s6d ocorre o rastreio biofísico (TN + Doppler de uterinas).'
      },
      {
        id: 'm_fim1tri',
        igLabel: '13s 6d',
        days: 97,
        title: 'Encerramento do 1º Trimestre (Queda no risco de abortamento)',
        category: 'Marco Clínico',
        desc: 'Transição para o 2º trimestre (em 14s 0d). Melhora gradual das náuseas/êmese gravídica pela estabilização dos níveis de beta-hCG.'
      },
      {
        id: 'm_aas',
        igLabel: 'Até 16s 0d',
        days: 112,
        title: 'Limite Ideal para Início da Profilaxia de Pré-Eclâmpsia (AAS + Cálcio)',
        category: 'Prevenção',
        desc: 'Em pacientes de alto risco para Pré-Eclâmpsia, o AAS em baixa dose (100-150mg à noite) deve ser iniciado idealmente entre 12s e 16s (antes do fim da 2ª onda de invasão trofoblástica) e mantido até 36 semanas.'
      },
      {
        id: 'm_quickening',
        igLabel: '18s 0d a 20s 0d',
        days: 126,
        endDays: 140,
        title: 'Percepção Materna dos Movimentos Fetais (Quickening) + Início da dTpa',
        category: 'Fisiologia & Vacina',
        desc: 'Multíparas percebem por volta de 16-18s; primigestas entre 18-20s. Fundo uterino atinge a cicatriz umbilical às 20s. Vacina dTpa liberada pelo PNI a partir de 20 semanas.'
      },
      {
        id: 'm_viabilidade',
        igLabel: '24s 0d',
        days: 168,
        title: 'Limite Clássico de Viabilidade Fetal Extrauterina',
        category: 'Marco Perinatal',
        desc: 'Peso fetal aproximado de 600-650g e início da produção de surfactante pelos pneumócitos tipo II. Define condutas ativas de neuroproteção (sulfato de magnésio) e corticoterapia antenatal em ameaça de parto prematuro.'
      },
      {
        id: 'm_3tri_rhogan_dtpa',
        igLabel: '28s 0d',
        days: 196,
        title: 'Início do 3º Trimestre • Imunoglobulina Anti-D (se Rh-) • Janela Ideal dTpa',
        category: 'Conduta Crítica',
        desc: isRhNegativo
          ? '⚠️ ATENÇÃO PACIENTE Rh NEGATIVO: Administrar Imunoglobulina Anti-D 300 mcg IM às 28 semanas (após Coombs Indireto negativo). Reforçar vacina dTpa.'
          : 'Entrada no 3º trimestre. Se gestante Rh negativo não sensibilizada, administrar Imunoglobulina Anti-D às 28s. Janela ideal para dTpa (27s a 36s) visando transferência máxima de anticorpos anti-coqueluche.'
      },
      {
        id: 'm_vsr',
        igLabel: '32s 0d a 36s 6d',
        days: 224,
        endDays: 258,
        title: 'Vacina contra Vírus Sincicial Respiratório (VSR - Abrysvo)',
        category: 'Imunização',
        desc: 'Dose única intramuscular recomendada entre 32 e 36 semanas (SBIm / FEBRASGO / MS) para proteção passiva do recém-nascido contra bronquiolite grave nos primeiros 6 meses de vida.'
      },
      {
        id: 'm_prematuro_tardio',
        igLabel: '34s 0d a 36s 6d',
        days: 238,
        endDays: 258,
        title: 'Período Pré-Termo Tardio (Maturidade Pulmonar em Transição)',
        category: 'Classificação',
        desc: 'Consultas de pré-natal passam a ser quinzenais (28s a 36s). Orientar mobilograma / contagem de movimentos fetais e sinais de alarme (perda líquida, sangramento, contrações rítmicas).'
      },
      {
        id: 'm_termo_precoce',
        igLabel: '37s 0d a 38s 6d',
        days: 259,
        endDays: 272,
        title: 'Gestação a Termo Precoce (Consultas Semanais)',
        category: 'Termo',
        desc: 'Feto atinge o termo a partir de 37s 0d. Porém, cesáreas eletivas sem indicação médica não devem ser agendadas antes de 39s 0d devido ao maior risco de taquipneia transitória do RN.'
      },
      {
        id: 'm_termo_completo',
        igLabel: '39s 0d a 40s 6d',
        days: 273,
        endDays: 286,
        title: 'Termo Completo (Menor Morbimortalidade Neonatal • DPP em 40s 0d)',
        category: 'Termo Ideal',
        desc: `Período de melhores desfechos perinatais. Data Provável do Parto (40s 0d) em ${formatBRDate(addDays(baseDum, 280))}.`
      },
      {
        id: 'm_termo_tardio',
        igLabel: '41s 0d a 41s 6d',
        days: 287,
        endDays: 293,
        title: 'Termo Tardio (Vigilância de Vitalidade Fetal e Indução)',
        category: 'Vigilância',
        desc: 'Avaliar vitalidade fetal a cada 48-72h (Cardiotocografia + Perfil Biofísico / MBV) e programar indução do trabalho de parto para evitar atingir 42 semanas.'
      },
      {
        id: 'm_postermo',
        igLabel: '≥ 42s 0d',
        days: 294,
        title: 'Pós-Termo / Gravidez Prolongada',
        category: 'Intervenção',
        desc: 'Elevação do risco de insuficiência placentária, oligodramnia e síndrome de aspiração meconial. Indicação formal de resolução da gestação.'
      }
    ];

    return rawMilestones.map((m) => {
      const targetDate = addDays(baseDum, m.days);
      const targetEndDate = m.endDays ? addDays(baseDum, m.endDays) : null;
      let state = 'upcoming';
      if (m.endDays) {
        if (currentDays > m.endDays) state = 'completed';
        else if (currentDays >= m.days && currentDays <= m.endDays) state = 'active';
      } else {
        if (currentDays >= m.days) state = 'completed';
        else if (m.days - currentDays <= 7) state = 'active';
      }
      return {
        ...m,
        targetDate,
        targetEndDate,
        state
      };
    });
  }, [calc.finalData, isRhNegativo]);

  // --- GERADOR DE TEXTO PARA PRONTUÁRIO MÉDICO ---
  const summaryText = useMemo(() => {
    if (!calc.finalData) return 'Preencha os dados da DUM ou Ultrassom para gerar o resumo clínico.';
    const lines = [];
    lines.push(`=== RESUMO OBSTÉTRICO E DATAÇÃO (${formatBRDate(calc.refDate)}) ===`);

    if (calc.hasValidDum) {
      lines.push(`• DUM: ${formatBRDate(calc.dumData.effectiveDum)} -> IG(DUM): ${calc.dumData.igAtRef.formatted} | DPP(DUM): ${formatBRDate(calc.dumData.dpp)}`);
    } else {
      lines.push(`• DUM: Incerta / Desconhecida`);
    }

    if (calc.hasValidUs) {
      lines.push(
        `• US Prévio (${formatBRDate(calc.usData.examDate)}): com ${calc.usData.igAtExam.formatted} -> IG(US): ${calc.usData.igAtRef.formatted} | DPP(US): ${formatBRDate(calc.usData.dpp)}`
      );
    }

    if (calc.redatingVerdict) {
      const v = calc.redatingVerdict;
      lines.push(
        `• Critério ACOG/FEBRASGO: Discrepância de ${v.discrepancyDays}d no US de ${v.igUsAtExam.formatted} (tolerância até ${v.criterion.maxDiff}d) -> ${
          v.shouldRedate ? 'REDATADO PELO US' : 'MANTIDA DUM'
        }`
      );
    }

    lines.push('');
    lines.push(
      `>>> IG ATUAL DEFINITIVA (${calc.activeSource === 'dum' ? 'Pela DUM' : 'Pelo US'}): ${calc.finalData.igAtRef.formatted} (${calc.clinicalMetrics.trimester}) <<<`
    );
    lines.push(`>>> DPP DEFINITIVA: ${formatBRDate(calc.finalData.dpp)} <<<`);
    lines.push('');
    lines.push(`--- CRONOGRAMA DE ULTRASSONOGRAFIAS (DATAS CALCULADAS) ---`);
    ultrasoundSchedule.forEach((u) => {
      if (u.window.status !== 'past') {
        const tag = u.window.status === 'current' ? '[SOLICITAR AGORA]' : '[PROGRAMAR]';
        lines.push(`${tag} ${u.title} (${u.igRangeLabel}): ${u.window.startFormatted} a ${u.window.endFormatted}`);
      }
    });

    lines.push('');
    lines.push(`--- JANELAS IMPORTANTES E VACINAS ---`);
    const baseDum = calc.finalData.effectiveDum;
    lines.push(`• Morfológico 1º Tri (11s-13s6d): ${formatBRDate(addDays(baseDum, 77))} a ${formatBRDate(addDays(baseDum, 97))}`);
    lines.push(`• Morfológico 2º Tri + Colo (20s-24s): ${formatBRDate(addDays(baseDum, 140))} a ${formatBRDate(addDays(baseDum, 168))}`);
    lines.push(`• Curva Glicêmica TOTG 75g (24s-28s): ${formatBRDate(addDays(baseDum, 168))} a ${formatBRDate(addDays(baseDum, 196))}`);
    if (isRhNegativo) {
      lines.push(`• [ALERTA Rh NEGATIVO] Imunoglobulina Anti-D (28s): ${formatBRDate(addDays(baseDum, 196))}`);
    }
    lines.push(`• Vacina dTpa (a partir de 20s, ideal 27s-36s): ${formatBRDate(addDays(baseDum, 189))} a ${formatBRDate(addDays(baseDum, 252))}`);
    lines.push(`• Vacina VSR / Abrysvo (32s-36s6d): ${formatBRDate(addDays(baseDum, 224))} a ${formatBRDate(addDays(baseDum, 258))}`);
    lines.push(`• Swab Vaginal/Retal EGB (35s-37s): ${formatBRDate(addDays(baseDum, 245))} a ${formatBRDate(addDays(baseDum, 259))}`);
    lines.push(`• Início do Termo (37s 0d): ${formatBRDate(addDays(baseDum, 259))} | Termo Completo (39s 0d): ${formatBRDate(addDays(baseDum, 273))}`);

    return lines.join('\n');
  }, [calc, ultrasoundSchedule, isRhNegativo]);

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* HEADER CLÍNICO */}
      <header className="bg-gradient-to-r from-teal-900 via-teal-800 to-indigo-900 text-white shadow-md border-b border-teal-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner">
                <Baby className="w-6 h-6 text-teal-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    ObstetriCalc Pro
                  </h1>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-300/30">
                    ACOG & FEBRASGO
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-teal-100/85">
                  Datação Gestacional, Redatação por US, Cronograma Morfológico e Rotina Pré-Natal
                </p>
              </div>
            </div>

            {/* BARRA DE CENÁRIOS RÁPIDOS E DATA DE REFERÊNCIA */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white/10 rounded-lg p-1 border border-white/15 text-xs">
                <span className="px-2 text-teal-200 font-medium hidden sm:inline">Casos Exemplo:</span>
                <button
                  onClick={() => loadClinicalExample('redatar_1tri')}
                  className="px-2.5 py-1 rounded-md hover:bg-white/15 transition text-white font-medium flex items-center gap-1"
                  title="Simula discrepância > 7 dias no 1º trimestre (Redata para US)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Redatar US
                </button>
                <button
                  onClick={() => loadClinicalExample('manter_dum')}
                  className="px-2.5 py-1 rounded-md hover:bg-white/15 transition text-white font-medium"
                  title="Simula US compatível com a DUM (Mantém DUM)"
                >
                  Manter DUM
                </button>
                <button
                  onClick={() => loadClinicalExample('terceiro_tri')}
                  className="px-2.5 py-1 rounded-md hover:bg-white/15 transition text-white font-medium"
                  title="Simula gestante no 3º trimestre (35 semanas)"
                >
                  3º Tri (35s)
                </button>
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-md hover:bg-rose-500/30 text-teal-100 hover:text-white transition ml-0.5"
                  title="Limpar campos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUNA ESQUERDA: ENTRADA DE DADOS (4 COLUNAS NO DESKTOP) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* CARD 1: DATA DA CONSULTA / REFERÊNCIA */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  Data de Referência do Cálculo
                </label>
                {refDateStr !== todayStr && (
                  <button
                    onClick={() => setRefDateStr(todayStr)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-semibold underline"
                  >
                    Voltar para Hoje
                  </button>
                )}
              </div>
              <input
                type="date"
                value={refDateStr}
                onChange={(e) => setRefDateStr(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Altere caso queira simular qual será a IG da paciente em uma data futura ou passada.
              </p>
            </div>

            {/* CARD 2: DUM (DATA DA ÚLTIMA MENSTRUAÇÃO) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    1. Cálculo pela DUM
                  </h2>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dumIncerta}
                    onChange={(e) => setDumIncerta(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  DUM incerta / ignorada
                </label>
              </div>

              {!dumIncerta ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      1º Dia da Última Menstruação
                    </label>
                    <input
                      type="date"
                      value={dumStr}
                      onChange={(e) => setDumStr(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {calc.hasValidDum && (
                    <div className="rounded-xl bg-teal-50/70 border border-teal-200/80 p-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-teal-700/80 block font-medium">IG pela DUM:</span>
                        <span className="text-base font-bold text-teal-950">
                          {calc.dumData.igAtRef.formatted}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-700/80 block font-medium">DPP (Naegele):</span>
                        <span className="text-base font-bold text-teal-950">
                          {formatBRDate(calc.dumData.dpp)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>DUM desconsiderada. A datação será guiada exclusivamente pela biometria do Ultrassom.</span>
                </div>
              )}
            </div>

            {/* CARD 3: ULTRASSOM PRÉVIO (US) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    2. Ultrassom Prévio (1º Exame)
                  </h2>
                </div>
                {usDateStr && (
                  <button
                    onClick={() => {
                      setUsDateStr('');
                      setUsWeeks('');
                      setUsDays('');
                    }}
                    className="text-xs text-slate-400 hover:text-rose-600"
                  >
                    Limpar US
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Data de Realização do Ultrassom
                  </label>
                  <input
                    type="date"
                    value={usDateStr}
                    onChange={(e) => setUsDateStr(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Idade Gestacional no Laudo do US
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="44"
                        placeholder="Ex: 12"
                        value={usWeeks}
                        onChange={(e) => setUsWeeks(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 pl-3.5 pr-16 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        semanas
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="6"
                        placeholder="0 a 6"
                        value={usDays}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (Number(val) >= 0 && Number(val) <= 6)) {
                            setUsDays(val);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-300 pl-3.5 pr-12 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        dias
                      </span>
                    </div>
                  </div>
                </div>

                {calc.hasValidUs && (
                  <div className="rounded-xl bg-indigo-50/70 border border-indigo-200/80 p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-indigo-700/80 block font-medium">IG Hoje pelo US:</span>
                        <span className="text-base font-bold text-indigo-950">
                          {calc.usData.igAtRef.formatted}
                        </span>
                      </div>
                      <div>
                        <span className="text-indigo-700/80 block font-medium">DPP pelo US:</span>
                        <span className="text-base font-bold text-indigo-950">
                          {formatBRDate(calc.usData.dpp)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-indigo-200/60 flex justify-between text-[11px] text-indigo-800">
                      <span>DUM Corrigida / Fictícia:</span>
                      <span className="font-bold">{formatBRDate(calc.usData.effectiveDum)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 4: PARÂMETROS CLÍNICOS ADICIONAIS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                Personalizar Alertas da Paciente
              </h2>
              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Gestante Rh Negativo (Parceiro Rh+)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Ativa alerta de Coombs mensal e Imunoglobulina Anti-D às 28s
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRhNegativo}
                    onChange={(e) => setIsRhNegativo(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Suscetível à Toxoplasmose (IgG - / IgM -)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Destaca repetição seriada da sorologia nos 3 trimestres
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={toxoSuscetivel}
                    onChange={(e) => setToxoSuscetivel(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* TABELA DE REFERÊNCIA RÁPIDA DE REDATAÇÃO ACOG */}
            <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 text-xs shadow-sm">
              <div className="flex items-center gap-2 font-bold text-teal-300 mb-2">
                <Scale className="w-4 h-4" />
                <span>Regra de Redatação (ACOG / FEBRASGO)</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Redatar a gestação pelo Ultrassom quando a discrepância entre IG(DUM) e IG(US) na data do exame for:
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-300">Até 8s 6d</span>
                  <span className="font-semibold text-teal-300">&gt; 5 dias</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-300">9s 0d a 15s 6d</span>
                  <span className="font-semibold text-teal-300">&gt; 7 dias</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-300">16s 0d a 21s 6d</span>
                  <span className="font-semibold text-teal-300">&gt; 10 dias</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-300">22s 0d a 27s 6d</span>
                  <span className="font-semibold text-teal-300">&gt; 14 dias</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-300">≥ 28s 0d</span>
                  <span className="font-semibold text-amber-300">&gt; 21 dias</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: PAINEL DE RESULTADOS E ABAS (8 COLUNAS NO DESKTOP) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* HERO CARD: IG DEFINITIVA E VEREDITO DE DATAÇÃO */}
            {calc.finalData ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
                
                {/* BANNER DE VEREDITO DE REDATAÇÃO (QUANDO AMBOS DUM E US ESTÃO PREENCHIDOS) */}
                {calc.redatingVerdict && (
                  <div
                    className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      calc.redatingVerdict.shouldRedate
                        ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                        : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          calc.redatingVerdict.shouldRedate
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {calc.redatingVerdict.shouldRedate ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider">
                            Veredito de Datação: {calc.redatingVerdict.shouldRedate ? 'Redatar pelo Ultrassom' : 'Manter DUM'}
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/80 border border-black/10">
                            Discrepância: {calc.redatingVerdict.discrepancyDays} {calc.redatingVerdict.discrepancyDays === 1 ? 'dia' : 'dias'} (Tolerância ≤ {calc.redatingVerdict.criterion.maxDiff}d)
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-90 leading-relaxed">
                          No dia do US ({formatBRDate(calc.usData.examDate)}), a IG pela DUM era{' '}
                          <strong>{calc.redatingVerdict.igDumAtExam.formatted}</strong> e o US apontou{' '}
                          <strong>{calc.redatingVerdict.igUsAtExam.formatted}</strong>. {calc.redatingVerdict.explanation}
                        </p>
                      </div>
                    </div>

                    {/* SELETOR MANUAL DE FONTE OFICIAL */}
                    <div className="flex items-center bg-white/90 p-1 rounded-xl border border-slate-300/80 shrink-0 self-start sm:self-center text-xs">
                      <button
                        onClick={() => setMethodOverride('auto')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          methodOverride === 'auto'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Auto
                      </button>
                      <button
                        onClick={() => setMethodOverride('dum')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          methodOverride === 'dum'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Forçar DUM
                      </button>
                      <button
                        onClick={() => setMethodOverride('us')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          methodOverride === 'us'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Forçar US
                      </button>
                    </div>
                  </div>
                )}

                {/* CORPO DO PAINEL DE IG DEFINITIVA */}
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                    
                    {/* BLOCO PRINCIPAL: IG ATUAL */}
                    <div className="md:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                          IG Definitiva ({calc.activeSource === 'dum' ? 'Pela DUM' : 'Pelo US'})
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/15 font-medium">
                          {formatShortBRDate(calc.refDate)}
                        </span>
                      </div>
                      <div className="text-4xl sm:text-5xl font-black tracking-tight my-1 text-white">
                        {calc.finalData.igAtRef.formatted}
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        {calc.finalData.igAtRef.fullFormatted}
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-teal-200 font-semibold">
                          {calc.clinicalMetrics.trimester}
                        </span>
                        <span className="text-slate-300">
                          {calc.finalData.igAtRef.totalDays} / 280 dias
                        </span>
                      </div>
                    </div>

                    {/* BLOCO SECUNDÁRIO: DPP, DUM EFETIVA, CONCEPÇÃO E BARRA DE PROGRESSO */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">
                            DPP Definitiva (40s)
                          </span>
                          <span className="text-xl font-extrabold text-teal-950 mt-0.5 block">
                            {formatBRDate(calc.finalData.dpp)}
                          </span>
                          <span className="text-[11px] text-teal-700">
                            {calc.clinicalMetrics.remainingDays >= 0
                              ? `Faltam ${calc.clinicalMetrics.remainingDays} dias`
                              : `Passaram ${Math.abs(calc.clinicalMetrics.remainingDays)} dias`}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            {calc.activeSource === 'dum' ? 'DUM Oficial' : 'DUM Corrigida (US)'}
                          </span>
                          <span className="text-lg font-bold text-slate-800 mt-0.5 block">
                            {formatBRDate(calc.finalData.effectiveDum)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Base para o cronograma
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Concepção Estimada
                          </span>
                          <span className="text-lg font-bold text-slate-800 mt-0.5 block">
                            ~ {formatBRDate(calc.finalData.conceptionDate)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Termo (37s): {formatShortBRDate(addDays(calc.finalData.effectiveDum, 259))}
                          </span>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESSO GESTACIONAL */}
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-700">
                            Status: <span className="text-teal-700">{calc.clinicalMetrics.termClassification}</span>
                          </span>
                          <span className="font-bold text-slate-800">
                            {calc.clinicalMetrics.progressPct}% concluído
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex relative">
                          {/* Divisórias sutis de trimestres (14s = 35%, 28s = 70%, 37s = 92.5%) */}
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 via-teal-600 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${calc.clinicalMetrics.progressPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
                          <span>0s</span>
                          <span>1º Tri (até 13s6d)</span>
                          <span>2º Tri (14s-27s6d)</span>
                          <span>3º Tri (28s+)</span>
                          <span>Termo (37s-40s)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ESTADO VAZIO SE NADA PREENCHIDO */
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center">
                <Baby className="w-12 h-12 text-teal-600 mx-auto mb-3 opacity-80" />
                <h3 className="text-lg font-bold text-slate-800">
                  Insira a DUM ou os dados do Ultrassom ao lado
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  O sistema calculará automaticamente a IG, DPP, necessidade de redatação e todas as datas exatas de exames morfológicos e laboratoriais.
                </p>
              </div>
            )}

            {/* NAVEGAÇÃO POR ABAS DAS SEÇÕES CLÍNICAS */}
            {calc.finalData && (
              <>
                <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200/90">
                  <button
                    onClick={() => setActiveTab('ultrassom')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'ultrassom'
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    <span>Cronograma de Ultrassom</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('laboratorio')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'laboratorio'
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Exames de Sangue / Rotina</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('marcos')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'marcos'
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Milestone className="w-4 h-4" />
                    <span>Marcos & Vacinas</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('prontuario')}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'prontuario'
                        ? 'bg-indigo-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Resumo p/ Prontuário</span>
                  </button>
                </div>

                {/* =========================================================
                    ABA 1: CRONOGRAMA DE ULTRASSONOGRAFIAS OBSTÉTRICAS
                   ========================================================= */}
                {activeTab === 'ultrassom' && (
                  <div className="space-y-4">
                    <div className="bg-teal-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2">
                          <Activity className="w-5 h-5 text-teal-300" />
                          Calendário de Ultrassonografias Calculado para a Paciente
                        </h3>
                        <p className="text-xs text-teal-100/85 mt-0.5">
                          Datas exatas calculadas a partir da {calc.activeSource === 'dum' ? 'DUM Oficial' : 'DUM Corrigida pelo US'} ({formatBRDate(calc.finalData.effectiveDum)}). Marque os exames já realizados/solicitados.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-semibold">
                          Verde = Janela Aberta Agora
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {ultrasoundSchedule.map((item) => {
                        const isDone = Boolean(checkedItems[item.id]);
                        const w = item.window;

                        let cardBorder = 'border-slate-200 bg-white';
                        let badgeStyle = 'bg-slate-100 text-slate-600';

                        if (isDone) {
                          cardBorder = 'border-slate-200 bg-slate-50/70 opacity-75';
                          badgeStyle = 'bg-emerald-100 text-emerald-800';
                        } else if (w.status === 'current') {
                          cardBorder = 'border-emerald-500 ring-2 ring-emerald-500/15 bg-white';
                          badgeStyle = 'bg-emerald-600 text-white animate-pulse';
                        } else if (w.status === 'soon') {
                          cardBorder = 'border-amber-300 bg-amber-50/20';
                          badgeStyle = 'bg-amber-100 text-amber-800 border border-amber-300';
                        } else if (w.status === 'past') {
                          cardBorder = 'border-slate-200 bg-slate-50/60';
                          badgeStyle = 'bg-slate-200 text-slate-600';
                        }

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border p-4 sm:p-5 transition shadow-xs ${cardBorder}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => toggleCheck(item.id)}
                                  className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                  title="Marcar como já realizado ou solicitado"
                                />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4
                                      className={`text-sm sm:text-base font-bold ${
                                        isDone ? 'line-through text-slate-500' : 'text-slate-900'
                                      }`}
                                    >
                                      {item.title}
                                    </h4>
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                                      IG: {item.igRangeLabel}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badgeStyle}`}>
                                      {isDone ? '✓ Exame Realizado / Solicitado' : w.statusLabel}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                      Prioridade: <strong>{item.priority}</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* CAIXA DE DATAS EXATAS DO EXAME */}
                              <div className="bg-slate-100/90 border border-slate-200/90 rounded-xl px-3.5 py-2 text-right shrink-0 self-start sm:self-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                  Período Ideal de Realização
                                </span>
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                                  {w.startFormatted} até {w.endFormatted}
                                </span>
                              </div>
                            </div>

                            {/* LISTA DE OBJETIVOS CLÍNICOS DO EXAME */}
                            <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-600">
                              {item.objectives.map((obj, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <ChevronRight className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                                  <span>{obj}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* =========================================================
                    ABA 2: EXAMES LABORATORIAIS DE ROTINA DO PRÉ-NATAL
                   ========================================================= */}
                {activeTab === 'laboratorio' && (
                  <div className="space-y-5">
                    <div className="bg-indigo-950 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2">
                          <FlaskConical className="w-5 h-5 text-indigo-300" />
                          Rotina Laboratorial de Pré-Natal por Trimestre e Janelas Críticas
                        </h3>
                        <p className="text-xs text-indigo-100/85 mt-0.5">
                          Protocolo integrado Ministério da Saúde / FEBRASGO. Clique nos exames para dar baixa no checklist da consulta.
                        </p>
                      </div>
                      <button
                        onClick={() => setCheckedItems({})}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100 font-medium self-start sm:self-center shrink-0"
                      >
                        Desmarcar Todos
                      </button>
                    </div>

                    {labPanels.map((panel) => {
                      const w = panel.window;
                      const isCurrentWindow = w.status === 'current';

                      return (
                        <div
                          key={panel.id}
                          className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${
                            isCurrentWindow ? 'border-teal-500 ring-2 ring-teal-500/15' : 'border-slate-200'
                          }`}
                        >
                          {/* CABEÇALHO DO TRIMESTRE / PAINEL */}
                          <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                                  {panel.title}
                                </h4>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                  {panel.igRangeLabel}
                                </span>
                                {isCurrentWindow && (
                                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                                    JANELA ATUAL • SOLICITAR AGORA
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {panel.clinicalNotes}
                              </p>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-right shrink-0 self-start sm:self-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Data Calculada ({panel.igRangeLabel})
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                                {w.startFormatted} a {w.endFormatted}
                              </span>
                            </div>
                          </div>

                          {/* GRADE DE EXAMES COM CHECKLIST */}
                          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {panel.exams.map((exam) => {
                              const checked = Boolean(checkedItems[exam.id]);
                              const hasWarning = exam.detail.includes('⚠️');
                              return (
                                <div
                                  key={exam.id}
                                  onClick={() => toggleCheck(exam.id)}
                                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 select-none ${
                                    checked
                                      ? 'bg-emerald-50/50 border-emerald-200 text-slate-500'
                                      : hasWarning
                                      ? 'bg-amber-50/60 border-amber-300 hover:bg-amber-50'
                                      : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/60'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 pointer-events-none"
                                  />
                                  <div className="text-xs">
                                    <span
                                      className={`font-bold block ${
                                        checked ? 'line-through text-slate-500' : 'text-slate-800'
                                      }`}
                                    >
                                      {exam.name}
                                    </span>
                                    <span
                                      className={`text-[11px] mt-0.5 block ${
                                        hasWarning && !checked ? 'text-amber-900 font-semibold' : 'text-slate-500'
                                      }`}
                                    >
                                      {exam.detail}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* =========================================================
                    ABA 3: MARCOS DA GRAVIDEZ, VACINAS E LINHA DO TEMPO
                   ========================================================= */}
                {activeTab === 'marcos' && (
                  <div className="space-y-5">
                    {/* CARDS DE VACINAÇÃO DA GESTANTE EM DESTAQUE */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="bg-white rounded-2xl p-4 border border-teal-200 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                            <Syringe className="w-3.5 h-3.5" /> Vacina dTpa
                          </span>
                          <span className="text-[11px] font-semibold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md">
                            A partir de 20s (Ideal 27-36s)
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {formatBRDate(addDays(calc.finalData.effectiveDum, 140))} a{' '}
                          {formatBRDate(addDays(calc.finalData.effectiveDum, 252))}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Obrigatória em TODA gestação para proteção neonatal contra Coqueluche.
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                            <Syringe className="w-3.5 h-3.5" /> Vacina VSR (Abrysvo)
                          </span>
                          <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-md">
                            32s 0d a 36s 6d
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {formatBRDate(addDays(calc.finalData.effectiveDum, 224))} a{' '}
                          {formatBRDate(addDays(calc.finalData.effectiveDum, 258))}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Prevenção de bronquiolite grave pelo Vírus Sincicial Respiratório no RN.
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                            <Syringe className="w-3.5 h-3.5" /> Influenza & Hepatite B
                          </span>
                          <span className="text-[11px] font-semibold bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md">
                            Qualquer IG
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-slate-900">
                          Liberadas desde o 1º Tri
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Influenza anual em qualquer trimestre. Hepatite B se Anti-HBs não reagente.
                        </p>
                      </div>
                    </div>

                    {/* LINHA DO TEMPO CRONOLÓGICA DOS MARCOS */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
                      <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
                        <Milestone className="w-5 h-5 text-teal-600" />
                        Linha do Tempo Obstétrica e Subdivisões do Termo
                      </h3>

                      <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
                        {pregnancyMilestones.map((m) => {
                          let dotStyle = 'bg-slate-300 ring-4 ring-white';
                          let cardStyle = 'bg-white border-slate-200';

                          if (m.state === 'completed') {
                            dotStyle = 'bg-teal-600 ring-4 ring-teal-100';
                            cardStyle = 'bg-slate-50/80 border-slate-200/80';
                          } else if (m.state === 'active') {
                            dotStyle = 'bg-emerald-500 ring-4 ring-emerald-200 animate-pulse';
                            cardStyle = 'bg-emerald-50/40 border-emerald-400 shadow-xs';
                          }

                          return (
                            <div key={m.id} className="relative">
                              {/* Ponto na linha do tempo */}
                              <span
                                className={`absolute -left-[31px] top-3 w-3.5 h-3.5 rounded-full ${dotStyle}`}
                              />

                              <div className={`rounded-xl border p-4 transition ${cardStyle}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-slate-900 text-white">
                                      {m.igLabel}
                                    </span>
                                    <h4 className="text-sm font-bold text-slate-900">
                                      {m.title}
                                    </h4>
                                  </div>

                                  <div className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/70 px-2.5 py-1 rounded-lg shrink-0 self-start sm:self-center">
                                    {m.targetEndDate
                                      ? `${formatBRDate(m.targetDate)} a ${formatBRDate(m.targetEndDate)}`
                                      : formatBRDate(m.targetDate)}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {m.desc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    ABA 4: GERADOR DE RESUMO PARA PRONTUÁRIO ELETRÔNICO
                   ========================================================= */}
                {activeTab === 'prontuario' && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-600" />
                          Evolução Estruturada para Prontuário / Caderneta da Gestante
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Texto formatado pronto para colar no prontuário eletrônico (PEP) ou imprimir para a paciente.
                        </p>
                      </div>

                      <button
                        onClick={handleCopySummary}
                        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs shrink-0 ${
                          copiedSummary
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {copiedSummary ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copiado para a Área de Transferência!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Resumo p/ Prontuário</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="w-full bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap select-all border border-slate-800">
                      {summaryText}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
