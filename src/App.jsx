import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Baby,
  Stethoscope,
  TestTube,
  ClipboardCheck,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Syringe,
  ShieldAlert
} from 'lucide-react';

// Funções utilitárias de data (fuso horário local seguro)
const parseLocal = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

const toInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatBR = (date) => {
  if (!date) return '-';
  return date.toLocaleDateString('pt-BR');
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const diffDays = (d1, d2) => {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
};

const formatIG = (totalDays) => {
  if (totalDays === null || isNaN(totalDays) || totalDays < 0) return '-';
  const w = Math.floor(totalDays / 7);
  const d = totalDays % 7;
  return `${w}s ${d}d`;
};

export default function App() {
  // Todos os estados iniciam em branco (sem paciente de exemplo)
  const [patientName, setPatientName] = useState('');
  const [refDate, setRefDate] = useState(toInputDate(new Date()));
  const [lmpDate, setLmpDate] = useState('');
  const [usgDate, setUsgDate] = useState('');
  const [usgWeeks, setUsgWeeks] = useState('');
  const [usgDays, setUsgDays] = useState('');
  const [datingMethod, setDatingMethod] = useState('auto'); // 'auto' | 'lmp' | 'usg'
  const [rhNegative, setRhNegative] = useState(false);
  const [toxoSusceptible, setToxoSusceptible] = useState(false);
  const [checkedExams, setCheckedExams] = useState({});
  const [activeTab, setActiveTab] = useState('usg');
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setPatientName('');
    setRefDate(toInputDate(new Date()));
    setLmpDate('');
    setUsgDate('');
    setUsgWeeks('');
    setUsgDays('');
    setDatingMethod('auto');
    setRhNegative(false);
    setToxoSusceptible(false);
    setCheckedExams({});
    setCopied(false);
  };

  const toggleExam = (id) => {
    setCheckedExams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Motor de Cálculo Obstétrico e Redatação (ACOG / FEBRASGO)
  const calc = useMemo(() => {
    const today = parseLocal(refDate) || new Date();
    const lmp = parseLocal(lmpDate);
    const usg = parseLocal(usgDate);
    const uW = usgWeeks !== '' ? parseInt(usgWeeks, 10) : null;
    const uD = usgDays !== '' ? parseInt(usgDays, 10) : 0;

    const hasLMP = Boolean(lmp);
    const hasUSG = Boolean(usg && uW !== null && !isNaN(uW) && uW >= 0);

    if (!hasLMP && !hasUSG) return null;

    let igDaysLMP = null;
    let dppLMP = null;
    if (hasLMP) {
      igDaysLMP = diffDays(today, lmp);
      dppLMP = addDays(lmp, 280);
    }

    let igAtUsgDays = null;
    let virtualLmpFromUsg = null;
    let igDaysUSG = null;
    let dppUSG = null;

    if (hasUSG) {
      igAtUsgDays = uW * 7 + (isNaN(uD) ? 0 : uD);
      virtualLmpFromUsg = addDays(usg, -igAtUsgDays);
      igDaysUSG = diffDays(today, virtualLmpFromUsg);
      dppUSG = addDays(virtualLmpFromUsg, 280);
    }

    // Regras de tolerância ACOG / FEBRASGO na data do exame de US
    let autoChoice = 'lmp';
    let redatingReason = '';
    let discrepancyDays = null;
    let toleranceLimit = null;

    if (hasLMP && hasUSG) {
      const lmpIgAtUsgDate = diffDays(usg, lmp);
      discrepancyDays = Math.abs(lmpIgAtUsgDate - igAtUsgDays);

      if (igAtUsgDays <= 62) {
        // Até 8s 6d -> > 5 dias
        toleranceLimit = 5;
      } else if (igAtUsgDays <= 97) {
        // 9s 0d a 13s 6d -> > 7 dias
        toleranceLimit = 7;
      } else if (igAtUsgDays <= 111) {
        // 14s 0d a 15s 6d -> > 7 dias
        toleranceLimit = 7;
      } else if (igAtUsgDays <= 153) {
        // 16s 0d a 21s 6d -> > 10 dias
        toleranceLimit = 10;
      } else if (igAtUsgDays <= 195) {
        // 22s 0d a 27s 6d -> > 14 dias
        toleranceLimit = 14;
      } else {
        // >= 28s 0d -> > 21 dias
        toleranceLimit = 21;
      }

      if (discrepancyDays > toleranceLimit) {
        autoChoice = 'usg';
        redatingReason = `Redatada pelo US: diferença de ${discrepancyDays} dias no dia do exame (limite de ${toleranceLimit}d para IG de ${formatIG(igAtUsgDays)}).`;
      } else {
        autoChoice = 'lmp';
        redatingReason = `Mantida DUM: diferença de ${discrepancyDays} dias no dia do exame dentro da tolerância (máx. ${toleranceLimit}d para ${formatIG(igAtUsgDays)}).`;
      }
    } else if (hasUSG && !hasLMP) {
      autoChoice = 'usg';
      redatingReason = 'Datação exclusiva por Ultrassonografia (DUM não informada/incerta).';
    } else {
      autoChoice = 'lmp';
      redatingReason = 'Datação exclusiva pela DUM (sem US prévio informado).';
    }

    const activeSource =
      datingMethod === 'auto'
        ? autoChoice
        : datingMethod === 'usg' && hasUSG
        ? 'usg'
        : hasLMP
        ? 'lmp'
        : 'usg';

    const effectiveZeroDate = activeSource === 'usg' ? virtualLmpFromUsg : lmp;
    const finalIgDays = activeSource === 'usg' ? igDaysUSG : igDaysLMP;
    const finalDPP = activeSource === 'usg' ? dppUSG : dppLMP;

    const trimester =
      finalIgDays < 98 ? '1º Trimestre' : finalIgDays < 196 ? '2º Trimestre' : '3º Trimestre';

    const progressPct = Math.min(100, Math.max(0, Math.round((finalIgDays / 280) * 100)));

    return {
      hasLMP,
      hasUSG,
      igDaysLMP,
      dppLMP,
      igDaysUSG,
      dppUSG,
      igAtUsgDays,
      discrepancyDays,
      toleranceLimit,
      autoChoice,
      activeSource,
      redatingReason,
      effectiveZeroDate,
      finalIgDays,
      finalDPP,
      trimester,
      progressPct
    };
  }, [refDate, lmpDate, usgDate, usgWeeks, usgDays, datingMethod]);

  // Cronograma de Ultrassonografias
  const usgSchedule = useMemo(() => {
    if (!calc) return [];
    const base = calc.effectiveZeroDate;
    const items = [
      {
        id: 'usg_tv',
        title: 'US Obstétrico Transvaginal Inicial',
        window: '6s 0d a 9s 6d',
        startDays: 42,
        endDays: 69,
        notes: 'Confirmação de gestação tópica, vitalidade embrionária (BCF), número de embriões/corionicidade e datação precoce pelo CCN.'
      },
      {
        id: 'usg_morf1',
        title: 'US Morfológico de 1º Trimestre + Doppler',
        window: '11s 0d a 13s 6d',
        startDays: 77,
        endDays: 97,
        notes: 'CCN (45–84 mm), Translucência Nucal (TN), Osso Nasal, Ducto Venoso, Regurgitação Tricúspide e Doppler de Artérias Uterinas (rastreio de pré-eclâmpsia).'
      },
      {
        id: 'usg_colo',
        title: 'Medida do Colo Uterino (Via Transvaginal)',
        window: '16s 0d a 24s 0d',
        startDays: 112,
        endDays: 168,
        notes: 'Rastreamento universal de prematuridade (realizado isoladamente em pacientes de alto risco ou junto ao Morfológico de 2º Tri).'
      },
      {
        id: 'usg_morf2',
        title: 'US Morfológico de 2º Trimestre',
        window: '20s 0d a 24s 0d',
        startDays: 140,
        endDays: 168,
        notes: 'Avaliação detalhada da anatomia fetal, biometria, placenta, líquido amniótico e medida transvaginal do colo uterino.'
      },
      {
        id: 'usg_eco',
        title: 'Ecocardiograma Fetal com Mapeamento de Fluxo',
        window: '24s 0d a 28s 0d',
        startDays: 168,
        endDays: 196,
        notes: 'Avaliação anatômica e funcional cardíaca detalhada (janela ideal entre 24 e 28 semanas).'
      },
      {
        id: 'usg_3tri_1',
        title: 'US Obstétrico de 3º Trimestre (Crescimento)',
        window: '28s 0d a 32s 0d',
        startDays: 196,
        endDays: 224,
        notes: 'Curva de crescimento fetal, peso estimado (percentil Hadlock), ILA/MBV e Dopplervelocimetria se indicada.'
      },
      {
        id: 'usg_3tri_2',
        title: 'US Obstétrico Final /Vitalidade Fetal',
        window: '34s 0d a 37s 0d',
        startDays: 238,
        endDays: 259,
        notes: 'Apresentação fetal, estimativa de peso próximo ao termo, volume de líquido amniótico e maturação placentária.'
      }
    ];

    return items.map((item) => {
      const startDate = addDays(base, item.startDays);
      const endDate = addDays(base, item.endDays);
      let status = 'upcoming';
      if (calc.finalIgDays >= item.startDays && calc.finalIgDays <= item.endDays) {
        status = 'current';
      } else if (calc.finalIgDays > item.endDays) {
        status = 'past';
      }
      return { ...item, startDate, endDate, status };
    });
  }, [calc]);

  // Rotina Laboratorial de Pré-Natal
  const labSchedule = useMemo(() => {
    if (!calc) return [];
    const base = calc.effectiveZeroDate;

    return [
      {
        id: 'lab_1tri',
        stage: '1º Trimestre (1ª Consulta / Imediato)',
        startDate: base,
        endDate: addDays(base, 97),
        isCurrent: calc.finalIgDays <= 97,
        exams: [
          { id: 'abo_rh', name: 'Tipagem Sanguínea ABO/Rh', desc: 'Se Rh negativo, solicitar Coombs Indireto.' },
          { id: 'hemograma1', name: 'Hemograma Completo', desc: 'Rastreio de anemia e avaliação plaquetária.' },
          { id: 'glicemia1', name: 'Glicemia de Jejum', desc: '≥ 92 a 125 mg/dL = DMG | ≥ 126 mg/dL = DM prévio.' },
          { id: 'tsh', name: 'TSH e T4 Livre', desc: 'Avaliação da função tireoidiana materna.' },
          { id: 'sorologias1', name: 'VDRL / Teste Rápido Sífilis, HIV, HBsAg e Anti-HCV', desc: 'Rastreio infeccioso obrigatório de 1º trimestre.' },
          { id: 'toxo1', name: 'Toxoplasmose IgG e IgM', desc: 'Se IgG e IgM negativos (suscetível), repetir a cada 1–2 meses.' },
          { id: 'rub_cmv', name: 'Rubéola e Citomegalovírus (IgG e IgM)', desc: 'Avaliação de imunidade prévia.' },
          { id: 'urina1', name: 'Sumário de Urina (EAS) + Urocultura com Antibiograma', desc: 'Rastreio de bacteriúria assintomática.' },
          { id: 'epf_cp', name: 'Parasitológico de Fezes e Colpocitologia Oncótica', desc: 'Coleta de preventivo se dentro da faixa/indicação.' }
        ]
      },
      {
        id: 'lab_2tri',
        stage: '2º Trimestre (24s 0d a 28s 0d)',
        startDate: addDays(base, 168),
        endDate: addDays(base, 196),
        isCurrent: calc.finalIgDays >= 168 && calc.finalIgDays <= 196,
        exams: [
          {
            id: 'totg75',
            name: 'TOTG 75g (Curva Glicêmica - Jejum, 1h e 2h)',
            desc: 'Padrão-ouro entre 24–28s para pacientes com glicemia inicial < 92 mg/dL (Limites: 92 / 180 / 153 mg/dL).'
          },
          { id: 'hemograma2', name: 'Hemograma Completo + Ferritina', desc: 'Controle de hemodiluição e reservas de ferro.' },
          { id: 'sorologias2', name: 'VDRL, Anti-HIV e HBsAg (2º Trimestre)', desc: 'Repetição sorológica de rotina.' },
          { id: 'urina2', name: 'Sumário de Urina (EAS) + Urocultura', desc: 'Controle de infecção urinária no 2º trimestre.' },
          ...(rhNegative
            ? [
                {
                  id: 'coombs_28s',
                  name: 'Coombs Indireto + Imunoglobulina Anti-D (às 28s)',
                  desc: 'GESTANTE Rh NEGATIVO: Realizar Coombs Indireto prévio e administrar Imunoglobulina Anti-D com 28 semanas.'
                }
              ]
            : []),
          ...(toxoSusceptible
            ? [
                {
                  id: 'toxo_mensal2',
                  name: 'Toxoplasmose IgG e IgM (Controle de Suscetível)',
                  desc: 'GESTANTE SUSCETÍVEL: Manter vigilância sorológica e orientações higiênico-dietéticas.'
                }
              ]
            : [])
        ]
      },
      {
        id: 'lab_3tri',
        stage: '3º Trimestre (32s 0d a 36s 0d)',
        startDate: addDays(base, 224),
        endDate: addDays(base, 252),
        isCurrent: calc.finalIgDays >= 224 && calc.finalIgDays <= 252,
        exams: [
          { id: 'hemograma3', name: 'Hemograma Completo + Coagulograma', desc: 'Avaliação pré-parto de hemoglobina e plaquetas.' },
          { id: 'sorologias3', name: 'VDRL, Anti-HIV, HBsAg e Anti-HCV (3º Trimestre)', desc: 'Exames obrigatórios para admissão na maternidade.' },
          { id: 'glicemia3', name: 'Glicemia de Jejum', desc: 'Controle metabólico de 3º trimestre.' },
          { id: 'urina3', name: 'Sumário de Urina (EAS) + Urocultura', desc: 'Rastreio final de ITU.' }
        ]
      },
      {
        id: 'lab_gb',
        stage: 'Rastreio de Estreptococo do Grupo B (35s 0d a 37s 0d)',
        startDate: addDays(base, 245),
        endDate: addDays(base, 259),
        isCurrent: calc.finalIgDays >= 245 && calc.finalIgDays <= 259,
        exams: [
          {
            id: 'swab_egb',
            name: 'Cultura para Estreptococo Beta-Hemolítico (Swab Vaginal e Retal)',
            desc: 'Coletar entre 35s 0d e 37s 0d para definir profilaxia antibiótica intraparto.'
          }
        ]
      }
    ];
  }, [calc, rhNegative, toxoSusceptible]);

  // Marcos Obstétricos e Vacinas
  const milestones = useMemo(() => {
    if (!calc) return [];
    const base = calc.effectiveZeroDate;
    return [
      { label: 'Fim do 1º Trimestre (14s 0d)', days: 98, desc: 'Redução do risco de abortamento espontâneo; término da suplementação exclusiva de ácido fólico.' },
      { label: 'Início da Vacina dTpa (20s 0d)', days: 140, desc: 'Vacina tríplice bacteriana acelular (difteria, tétano e coqueluche) a partir de 20 semanas.' },
      { label: 'Viabilidade Fetal / Limite Periviável (24s 0d)', days: 168, desc: 'Marco anatômico e pulmonar de viabilidade extrauterina.' },
      { label: 'Início do 3º Trimestre + Imunoglobulina Anti-D (28s 0d)', days: 196, desc: 'Profilaxia Anti-D se Rh negativo e Coombs Indireto negativo.' },
      { label: 'Vacina Vírus Sincicial Respiratório - VSR (32s 0d a 36s 0d)', days: 224, desc: 'Imunização materna para prevenção de bronquiolite grave no RN (Abrysvo).' },
      { label: 'Termo Precoce (37s 0d a 38s 6d)', days: 259, desc: 'Início da gestação a termo.' },
      { label: 'Termo Completo (39s 0d a 40s 6d)', days: 273, desc: 'Faixa de menor morbidade neonatal respiratória.' },
      { label: 'Data Provável do Parto - DPP (40s 0d)', days: 280, desc: 'Completam-se 280 dias (40 semanas).' },
      { label: 'Termo Tardio (41s 0d a 41s 6d)', days: 287, desc: 'Intensificar vigilância de vitalidade fetal e avaliar resolução.' }
    ].map((m) => ({
      ...m,
      date: addDays(base, m.days),
      reached: calc.finalIgDays >= m.days
    }));
  }, [calc]);

  // Texto estruturado para prontuário médico
  const clinicalSummaryText = useMemo(() => {
    if (!calc) return '';
    const lines = [];
    if (patientName.trim()) lines.push(`PACIENTE: ${patientName.trim()}`);
    lines.push(`DATA DA AVALIAÇÃO: ${formatBR(parseLocal(refDate))}`);
    if (calc.hasLMP) {
      lines.push(`• DUM: ${formatBR(parseLocal(lmpDate))} -> IG (DUM): ${formatIG(calc.igDaysLMP)} | DPP (DUM): ${formatBR(calc.dppLMP)}`);
    }
    if (calc.hasUSG) {
      lines.push(
        `• US (${formatBR(parseLocal(usgDate))} com ${formatIG(calc.igAtUsgDays)}) -> IG (US): ${formatIG(calc.igDaysUSG)} | DPP (US): ${formatBR(calc.dppUSG)}`
      );
    }
    lines.push(`• CONDUTA DE DATAÇÃO: ${calc.redatingReason}`);
    lines.push(
      `• IDADE GESTACIONAL DEFINITIVA (${calc.activeSource === 'usg' ? 'US' : 'DUM'}): ${formatIG(calc.finalIgDays)} (${calc.trimester}) | DPP: ${formatBR(calc.finalDPP)}`
    );

    const nextUsg = usgSchedule.find((u) => u.status === 'current' || u.status === 'upcoming');
    if (nextUsg) {
      lines.push(`• PRÓXIMO ULTRASSOM: ${nextUsg.title} (${formatBR(nextUsg.startDate)} a ${formatBR(nextUsg.endDate)})`);
    }

    const totgStart = formatBR(addDays(calc.effectiveZeroDate, 168));
    const totgEnd = formatBR(addDays(calc.effectiveZeroDate, 196));
    const egbStart = formatBR(addDays(calc.effectiveZeroDate, 245));
    const egbEnd = formatBR(addDays(calc.effectiveZeroDate, 259));
    lines.push(`• JANELAS LABORATORIAIS: TOTG 75g (${totgStart} a ${totgEnd}) | Swab EGB (${egbStart} a ${egbEnd})`);

    return lines.join('\n');
  }, [calc, patientName, refDate, lmpDate, usgDate, usgSchedule]);

  const copySummary = () => {
    if (!clinicalSummaryText) return;
    navigator.clipboard.writeText(clinicalSummaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Cabeçalho */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-sky-500/20 p-2 rounded-xl border border-sky-400/30">
              <Stethoscope className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Calculadora Obstétrica</h1>
              <p className="text-xs text-slate-400">Datação ACOG/FEBRASGO • US • Rotina Pré-Natal • por Tadeu Rodriguez Carval 13011/CE</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Limpar / Nova Consulta
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        {/* Bloco de Entrada de Dados */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Nome da Paciente (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Maria Silva"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Data da Consulta / Referência
              </label>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: DUM */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-800">1. Data da Última Menstruação (DUM)</h2>
              </div>
              <label className="block text-xs text-slate-600 mb-1">Informe a DUM (se conhecida):</label>
              <input
                type="date"
                value={lmpDate}
                onChange={(e) => setLmpDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            {/* Card 2: Ultrassom Prévio */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Baby className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-bold text-slate-800">2. Ultrassom Prévio (1º Exame)</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-xs text-slate-600 mb-1">Data do Exame</label>
                  <input
                    type="date"
                    value={usgDate}
                    onChange={(e) => setUsgDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Semanas no US</label>
                  <input
                    type="number"
                    min="4"
                    max="42"
                    placeholder="Ex: 8"
                    value={usgWeeks}
                    onChange={(e) => setUsgWeeks(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Dias (0 a 6)</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    placeholder="Ex: 3"
                    value={usgDays}
                    onChange={(e) => setUsgDays(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filtros Clínicos Rápidos */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rhNegative}
                  onChange={(e) => setRhNegative(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                Gestante Rh Negativo (Alerta Coombs / Anti-D)
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={toxoSusceptible}
                  onChange={(e) => setToxoSusceptible(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                Suscetível à Toxoplasmose (IgG Negativo)
              </label>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Critério:</span>
              {['auto', 'lmp', 'usg'].map((m) => (
                <button
                  key={m}
                  onClick={() => setDatingMethod(m)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    datingMethod === m
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m === 'auto' ? 'Automático (ACOG)' : m === 'lmp' ? 'Forçar DUM' : 'Forçar US'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Estado Vazio: Exibido quando nenhum dado foi preenchido ainda */}
        {!calc ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Aguardando dados da gestante
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Preencha a <strong>DUM</strong> ou os dados do <strong>Ultrassom Prévio</strong> nos campos acima para calcular automaticamente a Idade Gestacional, Redatação, Cronograma de Ultrassonografias e Exames de Pré-Natal.
            </p>
          </div>
        ) : (
          <>
            {/* Painel Principal de Resultados */}
            <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 mb-2">
                    IG Definitiva ({calc.activeSource === 'usg' ? 'Pelo Ultrassom' : 'Pela DUM'})
                  </span>
                  <div className="text-4xl font-extrabold tracking-tight text-white">
                    {formatIG(calc.finalIgDays)}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{calc.trimester} • {calc.progressPct}% concluído</p>
                </div>

                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                  <div className="text-xs text-slate-300">Data Provável do Parto (40s)</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-0.5">{formatBR(calc.finalDPP)}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Termo Completo (39s): {formatBR(addDays(calc.effectiveZeroDate, 273))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pela DUM:</span>
                    <span className="font-semibold text-white">
                      {calc.hasLMP ? `${formatIG(calc.igDaysLMP)} (DPP: ${formatBR(calc.dppLMP)})` : 'Não informada'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pelo Ultrassom:</span>
                    <span className="font-semibold text-white">
                      {calc.hasUSG ? `${formatIG(calc.igDaysUSG)} (DPP: ${formatBR(calc.dppUSG)})` : 'Não informado'}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-white/10 text-amber-300 flex items-start gap-1.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{calc.redatingReason}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Navegação por Abas */}
            <div className="flex overflow-x-auto gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
              {[
                { id: 'usg', label: 'Cronograma de US', icon: Baby },
                { id: 'labs', label: 'Exames de Sangue / Rotina', icon: TestTube },
                { id: 'marcos', label: 'Marcos & Vacinas', icon: Syringe },
                { id: 'prontuario', label: 'Resumo p/ Prontuário', icon: ClipboardCheck }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition flex-1 justify-center ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ABA 1: Cronograma de Ultrassonografias */}
            {activeTab === 'usg' && (
              <div className="space-y-3">
                {usgSchedule.map((u) => (
                  <div
                    key={u.id}
                    className={`rounded-2xl p-4 border transition bg-white ${
                      u.status === 'current'
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : u.status === 'past'
                        ? 'border-slate-200 opacity-75'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleExam(u.id)}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            checkedExams[u.id]
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checkedExams[u.id] && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{u.title}</h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              {u.window}
                            </span>
                            {u.status === 'current' && (
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Na janela ideal agora
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{u.notes}</p>
                        </div>
                      </div>
                      <div className="sm:text-right pl-8 sm:pl-0 shrink-0">
                        <div className="text-xs text-slate-400">Período recomendado</div>
                        <div className="text-sm font-bold text-slate-800">
                          {formatBR(u.startDate)} a {formatBR(u.endDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ABA 2: Rotina Laboratorial */}
            {activeTab === 'labs' && (
              <div className="space-y-4">
                {labSchedule.map((group) => (
                  <div
                    key={group.id}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 ${
                      group.isCurrent ? 'border-sky-500 ring-2 ring-sky-500/15' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{group.stage}</h3>
                        {group.isCurrent && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
                            Fase Atual
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        Janela: {formatBR(group.startDate)} a {formatBR(group.endDate)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {group.exams.map((ex) => (
                        <div
                          key={ex.id}
                          onClick={() => toggleExam(ex.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                            checkedExams[ex.id]
                              ? 'bg-emerald-50/60 border-emerald-300'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checkedExams[ex.id]
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-400 bg-white'
                            }`}
                          >
                            {checkedExams[ex.id] && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{ex.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{ex.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ABA 3: Marcos e Vacinas */}
            {activeTab === 'marcos' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start justify-between gap-4 p-3 rounded-xl border ${
                      m.reached ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {m.reached ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-800">{m.label}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{m.desc}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-800 shrink-0">{formatBR(m.date)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ABA 4: Resumo para Prontuário */}
            {activeTab === 'prontuario' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Texto estruturado para evolução clínica
                  </h3>
                  <button
                    onClick={copySummary}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-xl transition"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar para o Prontuário'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {clinicalSummaryText}
                </pre>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
