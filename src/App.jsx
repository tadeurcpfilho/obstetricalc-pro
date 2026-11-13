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
        notes: 'Confirmação de gestação tópica, vitalidade embrionária (BCF), número de emb
