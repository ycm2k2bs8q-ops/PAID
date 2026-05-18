"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TipoMovimento = "entrata" | "uscita";
type Sezione = "recap" | "movimenti" | "categorie" | "piani";
type FiltroPeriodo = "tutto" | "mese" | "anno" | "personalizzato";

type Movimento = {
  id: number;
  tipo: TipoMovimento;
  pagante: string;
  data: string;
  versoChi: string;
  importo: number;
  categoria: string;
  nota: string;
};

type PianoAnnualeVoce = {
  categoria: string;
  budget: number;
};

type PianoMensile = {
  id: string;
  mese: string;
  budget: Record<string, number>;
};

type NuovoMovimento = {
  tipo: TipoMovimento;
  pagante: string;
  data: string;
  versoChi: string;
  importo: string;
  categoria: string;
  nota: string;
};

type CategoriaCalcolata = {
  nome: string;
  entrate: number;
  uscite: number;
  saldo: number;
  numeroMovimenti: number;
};

const categorieDisponibili = [
  "ENTRATA",
  "MUST",
  "CIBO",
  "REGALI",
  "MENSILI",
  "VIAGGI",
  "USCITE",
  "BIMBA",
  "ALTRO",
  "BOLLETTE",
  "SALUTE",
];

const categorieBudget = categorieDisponibili.filter(
  (categoria) => categoria !== "ENTRATA"
);

const stileCategorie: Record<
  string,
  { icona: string; colore: string; bg: string; bordo: string }
> = {
  ENTRATA: {
    icona: "💰",
    colore: "text-emerald-600",
    bg: "bg-emerald-50",
    bordo: "border-emerald-100",
  },
  MUST: {
    icona: "⭐",
    colore: "text-yellow-600",
    bg: "bg-yellow-50",
    bordo: "border-yellow-100",
  },
  CIBO: {
    icona: "🍝",
    colore: "text-orange-600",
    bg: "bg-orange-50",
    bordo: "border-orange-100",
  },
  REGALI: {
    icona: "🎁",
    colore: "text-pink-600",
    bg: "bg-pink-50",
    bordo: "border-pink-100",
  },
  MENSILI: {
    icona: "📅",
    colore: "text-blue-600",
    bg: "bg-blue-50",
    bordo: "border-blue-100",
  },
  VIAGGI: {
    icona: "✈️",
    colore: "text-cyan-600",
    bg: "bg-cyan-50",
    bordo: "border-cyan-100",
  },
  USCITE: {
    icona: "🍸",
    colore: "text-purple-600",
    bg: "bg-purple-50",
    bordo: "border-purple-100",
  },
  BIMBA: {
    icona: "🐈‍⬛",
    colore: "text-rose-600",
    bg: "bg-rose-50",
    bordo: "border-rose-100",
  },
  ALTRO: {
    icona: "📦",
    colore: "text-zinc-600",
    bg: "bg-zinc-100",
    bordo: "border-zinc-200",
  },
  BOLLETTE: {
    icona: "💡",
    colore: "text-amber-600",
    bg: "bg-amber-50",
    bordo: "border-amber-100",
  },
  SALUTE: {
    icona: "🩺",
    colore: "text-red-600",
    bg: "bg-red-50",
    bordo: "border-red-100",
  },
};

function numeroSicuro(valore: number) {
  return Number.isFinite(valore) ? valore : 0;
}

function formatEuro(valore: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(numeroSicuro(valore));
}

function formatNumero(valore: number) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(numeroSicuro(valore));
}

function formatPercentuale(valore: number) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(numeroSicuro(valore));
}

function normalizzaImporto(importo: string) {
  const valore = String(importo || "")
    .replaceAll("€", "")
    .replaceAll(" ", "")
    .replaceAll(String.fromCharCode(160), "")
    .trim();

  if (!valore) return NaN;

  const haVirgola = valore.includes(",");
  const haPunto = valore.includes(".");

  if (haVirgola && haPunto) {
    const ultimaVirgola = valore.lastIndexOf(",");
    const ultimoPunto = valore.lastIndexOf(".");

    if (ultimaVirgola > ultimoPunto) {
      return Number(valore.replaceAll(".", "").replace(",", "."));
    }

    return Number(valore.replaceAll(",", ""));
  }

  if (haVirgola) {
    return Number(valore.replace(",", "."));
  }

  if (haPunto) {
    const parti = valore.split(".");

    const sembraMigliaia =
      parti.length > 1 &&
      parti.slice(1).every((parte) => parte.length === 3);

    if (sembraMigliaia) {
      return Number(valore.replaceAll(".", ""));
    }

    return Number(valore);
  }

  return Number(valore);
}

function formatInputImporto(valore: string) {
  const numero = normalizzaImporto(valore);
  if (Number.isNaN(numero) || numero <= 0) return "";

  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(numero);
}

function meseCorrente() {
  const oggi = new Date();
  return `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
}

function categoriaStile(categoria: string) {
  return stileCategorie[categoria] || stileCategorie.ALTRO;
}

function movimentoInMese(movimento: Movimento, mese: string) {
  return movimento.data.startsWith(mese);
}

function nuovoMovimentoVuoto(): NuovoMovimento {
  return {
    tipo: "uscita",
    pagante: "",
    data: new Date().toISOString().slice(0, 10),
    versoChi: "",
    importo: "",
    categoria: "",
    nota: "",
  };
}

function movimentoToForm(movimento: Movimento): NuovoMovimento {
  return {
    tipo: movimento.tipo,
    pagante: movimento.pagante,
    data: movimento.data,
    versoChi: movimento.versoChi,
    importo: formatInputImporto(String(movimento.importo).replace(".", ",")),
    categoria: movimento.categoria,
    nota: movimento.nota,
  };
}

function normalizzaCategoria(categoria: string) {
  const pulita = categoria.trim().toUpperCase();
  return categorieDisponibili.includes(pulita) ? pulita : "ALTRO";
}

function normalizzaTipo(tipo: string): TipoMovimento {
  const pulito = tipo.trim().toLowerCase();
  return pulito === "entrata" ? "entrata" : "uscita";
}

function normalizzaData(data: string) {
  const pulita = data.trim();
  if (pulita.includes("-")) return pulita;

  const parti = pulita.split("/");
  if (parti.length !== 3) return pulita;

  const giorno = parti[0].padStart(2, "0");
  const mese = parti[1].padStart(2, "0");
  const anno = parti[2];

  return `${anno}-${mese}-${giorno}`;
}

function dividiRigaCSV(riga: string, separatore: string) {
  const valori: string[] = [];
  let valore = "";
  let dentroVirgolette = false;

  for (let i = 0; i < riga.length; i += 1) {
    const carattere = riga[i];
    const prossimo = riga[i + 1];

    if (carattere === '"' && prossimo === '"') {
      valore += '"';
      i += 1;
    } else if (carattere === '"') {
      dentroVirgolette = !dentroVirgolette;
    } else if (carattere === separatore && !dentroVirgolette) {
      valori.push(valore.trim());
      valore = "";
    } else {
      valore += carattere;
    }
  }

  valori.push(valore.trim());
  return valori;
}

export default function Home() {
  const [sezione, setSezione] = useState<Sezione>("movimenti");
  const [mostraForm, setMostraForm] = useState(false);
  const [movimentoInModifica, setMovimentoInModifica] = useState<number | null>(null);
  const [movimenti, setMovimenti] = useState<Movimento[]>([]);
  const [pianoAnnuale, setPianoAnnuale] = useState<PianoAnnualeVoce[]>([]);
  const [pianiMensili, setPianiMensili] = useState<PianoMensile[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("tutto");
  const [categorieFiltroMovimenti, setCategorieFiltroMovimenti] = useState<string[]>([]);
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [mesePianoAttivo, setMesePianoAttivo] = useState(meseCorrente());
  const [pianoAnnualeAperto, setPianoAnnualeAperto] = useState(false);
  const [pianoMensileAperto, setPianoMensileAperto] = useState(false);
  const [budgetAnnualeDraft, setBudgetAnnualeDraft] = useState<Record<string, string>>({});
  const [budgetMensileDraft, setBudgetMensileDraft] = useState<Record<string, string>>({});
  const [recapAnnualeAperto, setRecapAnnualeAperto] = useState(true);
  const [mesiRecapAperti, setMesiRecapAperti] = useState<Record<string, boolean>>({});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [pianiCaricati, setPianiCaricati] = useState(false);
  const [nuovoMovimento, setNuovoMovimento] = useState<NuovoMovimento>(nuovoMovimentoVuoto());

  useEffect(() => {
    async function caricaMovimenti() {
      setCaricamento(true);

      const { data, error } = await supabase
        .from("movimenti")
        .select("*")
        .order("data", { ascending: false })
        .order("id", { ascending: false });

      if (error) {
        console.error("Errore caricamento movimenti:", error);
        alert("Errore durante il caricamento dei movimenti da Supabase");
        setCaricamento(false);
        return;
      }

      const movimentiConvertiti: Movimento[] = (data || []).map((item) => ({
        id: Number(item.id),
        tipo: item.tipo as TipoMovimento,
        pagante: item.pagante || "",
        data: item.data,
        versoChi: item.verso_chi || "",
        importo: Number(item.importo),
        categoria: item.categoria || "ALTRO",
        nota: item.nota || "",
      }));

      setMovimenti(movimentiConvertiti);
      setCaricamento(false);
    }

    caricaMovimenti();
  }, []);

 useEffect(() => {
  async function caricaPiani() {
    const { data, error } = await supabase
      .from("app_state")
      .select("*")
      .in("key", ["pianoAnnuale", "pianiMensili"]);

    if (error) {
      console.error("Errore caricamento piani:", error);
      setPianiCaricati(true);
      return;
    }

    const pianoAnnualeOnline = data?.find((item) => item.key === "pianoAnnuale");
    const pianiMensiliOnline = data?.find((item) => item.key === "pianiMensili");

    if (pianoAnnualeOnline?.value) {
      setPianoAnnuale(pianoAnnualeOnline.value as PianoAnnualeVoce[]);
    }

    if (pianiMensiliOnline?.value) {
      setPianiMensili(pianiMensiliOnline.value as PianoMensile[]);
    }

    setPianiCaricati(true);
  }

  caricaPiani();
}, []);

useEffect(() => {
  if (!pianiCaricati) return;

  async function salvaPianoAnnuale() {
    const { error } = await supabase.from("app_state").upsert({
      key: "pianoAnnuale",
      value: pianoAnnuale,
      updated_at: new Date().toISOString(),
    });

    if (error) console.error("Errore salvataggio piano annuale:", error);
  }

  salvaPianoAnnuale();
}, [pianoAnnuale, pianiCaricati]);

useEffect(() => {
  if (!pianiCaricati) return;

  async function salvaPianiMensili() {
    const { error } = await supabase.from("app_state").upsert({
      key: "pianiMensili",
      value: pianiMensili,
      updated_at: new Date().toISOString(),
    });

    if (error) console.error("Errore salvataggio piani mensili:", error);
  }

  salvaPianiMensili();
}, [pianiMensili, pianiCaricati]);

  const totale = useMemo(
    () =>
      movimenti.reduce((somma, movimento) => {
        return movimento.tipo === "entrata"
          ? somma + movimento.importo
          : somma - movimento.importo;
      }, 0),
    [movimenti]
  );

  const totaleEntrate = useMemo(
    () =>
      movimenti
        .filter((movimento) => movimento.tipo === "entrata")
        .reduce((somma, movimento) => somma + movimento.importo, 0),
    [movimenti]
  );

  const totaleUscite = useMemo(
    () =>
      movimenti
        .filter((movimento) => movimento.tipo === "uscita")
        .reduce((somma, movimento) => somma + movimento.importo, 0),
    [movimenti]
  );

  function movimentoNelPeriodo(movimento: Movimento) {
    if (!movimento.data) return false;

    const oggi = new Date();
    const dataMovimento = new Date(`${movimento.data}T00:00:00`);

    if (filtroPeriodo === "tutto") return true;

    if (filtroPeriodo === "mese") {
      return (
        dataMovimento.getMonth() === oggi.getMonth() &&
        dataMovimento.getFullYear() === oggi.getFullYear()
      );
    }

    if (filtroPeriodo === "anno") {
      return dataMovimento.getFullYear() === oggi.getFullYear();
    }

    if (filtroPeriodo === "personalizzato") {
      if (!dataInizio || !dataFine) return true;
      return (
        dataMovimento >= new Date(`${dataInizio}T00:00:00`) &&
        dataMovimento <= new Date(`${dataFine}T23:59:59`)
      );
    }

    return true;
  }

  const movimentiFiltrati = useMemo(
    () => movimenti.filter(movimentoNelPeriodo),
    [movimenti, filtroPeriodo, dataInizio, dataFine]
  );

  const categorie = useMemo(() => {
    return movimentiFiltrati.reduce((acc, movimento) => {
      const nome = movimento.categoria || "ALTRO";

      if (!acc[nome]) {
        acc[nome] = {
          nome,
          entrate: 0,
          uscite: 0,
          saldo: 0,
          numeroMovimenti: 0,
        };
      }

      if (movimento.tipo === "entrata") {
        acc[nome].entrate += movimento.importo;
        acc[nome].saldo += movimento.importo;
      } else {
        acc[nome].uscite += movimento.importo;
        acc[nome].saldo -= movimento.importo;
      }

      acc[nome].numeroMovimenti += 1;
      return acc;
    }, {} as Record<string, CategoriaCalcolata>);
  }, [movimentiFiltrati]);

  const listaCategorie = useMemo(
    () => Object.values(categorie).sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)),
    [categorie]
  );

  const movimentiDaMostrare = useMemo(() => {
    if (categorieFiltroMovimenti.length === 0) return movimenti;

    return movimenti.filter((movimento) =>
      categorieFiltroMovimenti.includes(movimento.categoria || "ALTRO")
    );
  }, [movimenti, categorieFiltroMovimenti]);

  const budgetAnnualeTotale = pianoAnnuale.reduce((somma, voce) => somma + voce.budget, 0);

  const spesaAnnualeTotale = movimenti
    .filter(
      (movimento) =>
        movimento.tipo === "uscita" &&
        new Date(`${movimento.data}T00:00:00`).getFullYear() === new Date().getFullYear()
    )
    .reduce((somma, movimento) => somma + movimento.importo, 0);

  const pianoMensileAttivo =
    pianiMensili.find((piano) => piano.mese === mesePianoAttivo) || {
      id: `${mesePianoAttivo}-auto`,
      mese: mesePianoAttivo,
      budget: {},
    };

  const budgetMensileTotale = Object.values(pianoMensileAttivo.budget).reduce(
    (somma, valore) => somma + valore,
    0
  );

  const spesaMensileTotale = movimenti
    .filter(
      (movimento) =>
        movimento.tipo === "uscita" && movimentoInMese(movimento, mesePianoAttivo)
    )
    .reduce((somma, movimento) => somma + movimento.importo, 0);

  function cambiaFiltroCategoriaMovimenti(categoria: string) {
    setCategorieFiltroMovimenti((correnti) => {
      if (correnti.includes(categoria)) {
        return correnti.filter((item) => item !== categoria);
      }

      return [...correnti, categoria];
    });
  }

  async function importaCSV(file: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const testo = String(reader.result || "")
          .split(String.fromCharCode(13))
          .join("")
          .trim();

        if (!testo) {
          alert("Il file CSV è vuoto");
          return;
        }

        const righe = testo
          .split(String.fromCharCode(10))
          .map((riga) => riga.trim())
          .filter(Boolean);

        const primaRiga = righe[0] || "";
        const separatore = primaRiga.includes(";") ? ";" : ",";
        const primaRigaColonne = dividiRigaCSV(primaRiga, separatore);
        const primaRigaMinuscola = primaRigaColonne.map((colonna) =>
          colonna.trim().toLowerCase()
        );

        const haIntestazione =
          primaRigaMinuscola.includes("data") ||
          primaRigaMinuscola.includes("tipo") ||
          primaRigaMinuscola.includes("importo");

        const indice = haIntestazione
          ? {
              data: primaRigaMinuscola.indexOf("data"),
              tipo: primaRigaMinuscola.indexOf("tipo"),
              pagante: primaRigaMinuscola.indexOf("pagante"),
              versoChi: primaRigaMinuscola.indexOf("versochi"),
              importo: primaRigaMinuscola.indexOf("importo"),
              categoria: primaRigaMinuscola.indexOf("categoria"),
              nota: primaRigaMinuscola.indexOf("nota"),
            }
          : {
              data: 0,
              tipo: 1,
              pagante: 2,
              versoChi: 3,
              importo: 4,
              categoria: 5,
              nota: 6,
            };

        if (indice.data === -1 || indice.tipo === -1 || indice.importo === -1) {
          alert("CSV non valido. Servono almeno data, tipo e importo.");
          return;
        }

        const righeDati = haIntestazione ? righe.slice(1) : righe;

        const importati: Movimento[] = righeDati
          .map((riga, index) => {
            const colonne = dividiRigaCSV(riga, separatore);
            const importo = normalizzaImporto(colonne[indice.importo] || "0");
            const data = normalizzaData(colonne[indice.data] || "");

            if (!data || Number.isNaN(importo) || importo <= 0) {
              return null;
            }

            const categoria =
              indice.categoria >= 0
                ? normalizzaCategoria(colonne[indice.categoria] || "ALTRO")
                : "ALTRO";

            return {
              id: Date.now() + index,
              data,
              tipo: categoria === "ENTRATA" ? "entrata" : normalizzaTipo(colonne[indice.tipo] || "uscita"),
              pagante: indice.pagante >= 0 ? colonne[indice.pagante]?.trim() || "" : "",
              versoChi: indice.versoChi >= 0 ? colonne[indice.versoChi]?.trim() || "" : "",
              importo,
              categoria,
              nota: indice.nota >= 0 ? colonne[indice.nota]?.trim() || "" : "",
            };
          })
          .filter(Boolean) as Movimento[];

        if (importati.length === 0) {
          alert("Nessun movimento valido trovato nel CSV");
          return;
        }

        const righeSupabase = importati.map((movimento) => ({
          id: movimento.id,
          tipo: movimento.tipo,
          pagante: movimento.pagante,
          data: movimento.data,
          verso_chi: movimento.versoChi,
          importo: movimento.importo,
          categoria: movimento.categoria,
          nota: movimento.nota,
        }));

        const { error } = await supabase.from("movimenti").upsert(righeSupabase);

        if (error) {
          console.error("Errore import CSV:", error);
          alert("Errore durante il salvataggio del CSV online");
          return;
        }

        setMovimenti((correnti) => [...importati, ...correnti]);
        alert(`Importati ${formatNumero(importati.length)} movimenti dal CSV`);
      } catch (errore) {
        console.error(errore);
        alert("Errore durante l'importazione del CSV");
      }
    };

    reader.readAsText(file);
  }

  function apriNuovoMovimento() {
    setMovimentoInModifica(null);
    setNuovoMovimento(nuovoMovimentoVuoto());
    setMostraForm(true);
  }

  function apriModificaMovimento(movimento: Movimento) {
    setMovimentoInModifica(movimento.id);
    setNuovoMovimento(movimentoToForm(movimento));
    setMostraForm(true);
  }

  async function salvaMovimento() {
    if (!nuovoMovimento.data || !nuovoMovimento.importo) {
      alert("Inserisci almeno data e importo");
      return;
    }

    if (!nuovoMovimento.categoria) {
      alert("Seleziona una categoria");
      return;
    }

    const importo = normalizzaImporto(nuovoMovimento.importo);

    if (Number.isNaN(importo) || importo <= 0) {
      alert("Inserisci un importo valido");
      return;
    }

    const tipoAutomatico: TipoMovimento =
      nuovoMovimento.categoria === "ENTRATA" ? "entrata" : "uscita";

    const movimentoSalvato: Movimento = {
      id: movimentoInModifica || Date.now(),
      tipo: tipoAutomatico,
      pagante: nuovoMovimento.pagante.trim(),
      data: nuovoMovimento.data,
      versoChi: nuovoMovimento.versoChi.trim(),
      importo,
      categoria: nuovoMovimento.categoria,
      nota: nuovoMovimento.nota.trim(),
    };

    setSalvataggio(true);

    const { error } = await supabase.from("movimenti").upsert({
      id: movimentoSalvato.id,
      tipo: movimentoSalvato.tipo,
      pagante: movimentoSalvato.pagante,
      data: movimentoSalvato.data,
      verso_chi: movimentoSalvato.versoChi,
      importo: movimentoSalvato.importo,
      categoria: movimentoSalvato.categoria,
      nota: movimentoSalvato.nota,
    });

    setSalvataggio(false);

    if (error) {
      console.error("Errore salvataggio movimento:", error);
      alert("Errore durante il salvataggio online");
      return;
    }

    if (movimentoInModifica) {
      setMovimenti((correnti) =>
        correnti.map((movimento) =>
          movimento.id === movimentoInModifica ? movimentoSalvato : movimento
        )
      );
    } else {
      setMovimenti((correnti) => [movimentoSalvato, ...correnti]);
    }

    annullaInserimento();
  }

  async function cancellaMovimento(id: number) {
    const conferma = confirm("Cancellare questo movimento?");
    if (!conferma) return;

    const { error } = await supabase.from("movimenti").delete().eq("id", id);

    if (error) {
      console.error("Errore cancellazione movimento:", error);
      alert("Errore durante la cancellazione online");
      return;
    }

    setMovimenti((correnti) => correnti.filter((movimento) => movimento.id !== id));
  }

  function annullaInserimento() {
    setNuovoMovimento(nuovoMovimentoVuoto());
    setMovimentoInModifica(null);
    setMostraForm(false);
  }

  function gestisciSwipeFine(id: number, touchEnd: number) {
    if (touchStart === null) return;
    const differenza = touchStart - touchEnd;
    if (differenza > 100) cancellaMovimento(id);
    setTouchStart(null);
  }

  function aggiornaBudgetAnnuale(categoria: string, valore: string) {
    const budget = normalizzaImporto(valore) || 0;

    setPianoAnnuale((pianoCorrente) => {
      const esiste = pianoCorrente.some((voce) => voce.categoria === categoria);
      if (!esiste) return [...pianoCorrente, { categoria, budget }];

      return pianoCorrente.map((voce) =>
        voce.categoria === categoria ? { ...voce, budget } : voce
      );
    });
  }

  function aggiornaBudgetMensile(categoria: string, valore: string) {
    const budget = normalizzaImporto(valore) || 0;

    setPianiMensili((pianiCorrenti) => {
      const pianoEsistente = pianiCorrenti.find((piano) => piano.mese === mesePianoAttivo);

      if (!pianoEsistente) {
        return [
          ...pianiCorrenti,
          {
            id: `${mesePianoAttivo}-${Date.now()}`,
            mese: mesePianoAttivo,
            budget: { [categoria]: budget },
          },
        ];
      }

      return pianiCorrenti.map((piano) =>
        piano.mese === mesePianoAttivo
          ? {
              ...piano,
              budget: {
                ...piano.budget,
                [categoria]: budget,
              },
            }
          : piano
      );
    });
  }

  function budgetAnnualeCategoria(categoria: string) {
    return pianoAnnuale.find((voce) => voce.categoria === categoria)?.budget || 0;
  }

  function budgetMensileCategoria(categoria: string) {
    return pianoMensileAttivo?.budget[categoria] || 0;
  }

  function spesaAnnualeCategoria(categoria: string) {
    return movimenti
      .filter(
        (movimento) =>
          movimento.tipo === "uscita" &&
          movimento.categoria === categoria &&
          new Date(`${movimento.data}T00:00:00`).getFullYear() === new Date().getFullYear()
      )
      .reduce((somma, movimento) => somma + movimento.importo, 0);
  }

  function spesaMensileCategoria(categoria: string) {
    return movimenti
      .filter(
        (movimento) =>
          movimento.tipo === "uscita" &&
          movimento.categoria === categoria &&
          movimentoInMese(movimento, mesePianoAttivo)
      )
      .reduce((somma, movimento) => somma + movimento.importo, 0);
  }

  function valoreDraftAnnuale(categoria: string) {
    if (budgetAnnualeDraft[categoria] !== undefined) return budgetAnnualeDraft[categoria];
    const budget = budgetAnnualeCategoria(categoria);
    return budget ? formatInputImporto(String(budget).replace(".", ",")) : "";
  }

  function valoreDraftMensile(categoria: string) {
    if (budgetMensileDraft[categoria] !== undefined) return budgetMensileDraft[categoria];
    const budget = budgetMensileCategoria(categoria);
    return budget ? formatInputImporto(String(budget).replace(".", ",")) : "";
  }

  function modificaBudgetAnnuale(categoria: string) {
    setBudgetAnnualeDraft((correnti) => ({
      ...correnti,
      [categoria]: budgetAnnualeCategoria(categoria)
        ? formatInputImporto(String(budgetAnnualeCategoria(categoria)).replace(".", ","))
        : "",
    }));
  }

  function modificaBudgetMensile(categoria: string) {
    setBudgetMensileDraft((correnti) => ({
      ...correnti,
      [categoria]: budgetMensileCategoria(categoria)
        ? formatInputImporto(String(budgetMensileCategoria(categoria)).replace(".", ","))
        : "",
    }));
  }

  function confermaBudgetAnnuale(categoria: string) {
    const valore = valoreDraftAnnuale(categoria);
    aggiornaBudgetAnnuale(categoria, valore);
    setBudgetAnnualeDraft((correnti) => ({
      ...correnti,
      [categoria]: formatInputImporto(valore),
    }));
  }

  function confermaBudgetMensile(categoria: string) {
    const valore = valoreDraftMensile(categoria);
    aggiornaBudgetMensile(categoria, valore);
    setBudgetMensileDraft((correnti) => ({
      ...correnti,
      [categoria]: formatInputImporto(valore),
    }));
  }

  function azzeraBudgetAnnuale(categoria: string) {
    aggiornaBudgetAnnuale(categoria, "0");
    setBudgetAnnualeDraft((correnti) => ({ ...correnti, [categoria]: "" }));
  }

  function azzeraBudgetMensile(categoria: string) {
    aggiornaBudgetMensile(categoria, "0");
    setBudgetMensileDraft((correnti) => ({ ...correnti, [categoria]: "" }));
  }

  const annoCorrente = new Date().getFullYear();

  const mesiAnno = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];

  const coloriGrafici = [
    "#18181b",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#71717a",
  ];

  function movimentiAnnoCorrente() {
    return movimenti.filter(
      (movimento) => new Date(`${movimento.data}T00:00:00`).getFullYear() === annoCorrente
    );
  }

  function movimentiDelMese(indiceMese: number) {
    return movimentiAnnoCorrente().filter(
      (movimento) => new Date(`${movimento.data}T00:00:00`).getMonth() === indiceMese
    );
  }

  function totalePerTipo(lista: Movimento[], tipo: TipoMovimento) {
    return lista
      .filter((movimento) => movimento.tipo === tipo)
      .reduce((somma, movimento) => somma + movimento.importo, 0);
  }

  function spesePerCategoriaDaMovimenti(lista: Movimento[]) {
    return categorieBudget
      .map((categoria) => ({
        categoria,
        valore: lista
          .filter(
            (movimento) =>
              movimento.tipo === "uscita" && movimento.categoria === categoria
          )
          .reduce((somma, movimento) => somma + movimento.importo, 0),
      }))
      .filter((voce) => voce.valore > 0)
      .sort((a, b) => b.valore - a.valore);
  }

  function datiLineaAnnuale() {
    return mesiAnno.map((mese, index) => {
      const movimentiMese = movimentiDelMese(index);
      return {
        mese,
        entrate: totalePerTipo(movimentiMese, "entrata"),
        uscite: totalePerTipo(movimentiMese, "uscita"),
      };
    });
  }

  function toggleMeseRecap(mese: string) {
    setMesiRecapAperti((correnti) => ({
      ...correnti,
      [mese]: !correnti[mese],
    }));
  }

  function meseCompleto(indiceMese: number) {
    return `${annoCorrente}-${String(indiceMese + 1).padStart(2, "0")}`;
  }

  function budgetOPCategoria(categoria: string, indiceMese: number) {
    if (indiceMese < 4) return null;
    const mese = meseCompleto(indiceMese);
    const piano = pianiMensili.find((item) => item.mese === mese);
    return piano?.budget[categoria] || 0;
  }

  function CardPerformanceAnnuale() {
    const movimentiAnno = movimentiAnnoCorrente();
    const entrateAnno = totalePerTipo(movimentiAnno, "entrata");
    const usciteAnno = totalePerTipo(movimentiAnno, "uscita");
    const saldoAnno = entrateAnno - usciteAnno;
    const massimo = Math.max(entrateAnno, usciteAnno, 1);
    const percentualeEntrate = Math.min((entrateAnno / massimo) * 100, 100);
    const percentualeUscite = Math.min((usciteAnno / massimo) * 100, 100);
    const capacitaRisparmio = entrateAnno > 0 ? (saldoAnno / entrateAnno) * 100 : 0;
    const topSpesa = spesePerCategoriaDaMovimenti(movimentiAnno)[0] || null;

    return (
      <div className="rounded-[2rem] bg-zinc-50 border border-zinc-200 p-5 h-full">
        <div className="flex items-start justify-between gap-4 mb-5">
          <h4 className="text-3xl font-black">{annoCorrente}</h4>
          <div
            className={`px-3 py-2 rounded-full text-xs font-black ${
              saldoAnno >= 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {saldoAnno >= 0 ? "Anno positivo" : "Anno negativo"}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-black text-emerald-700">Entrate</span>
              <span className="font-black text-emerald-700">{formatEuro(entrateAnno)}</span>
            </div>
            <div className="h-3 rounded-full bg-white border border-zinc-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${percentualeEntrate}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-black text-red-700">Spese</span>
              <span className="font-black text-red-700">{formatEuro(usciteAnno)}</span>
            </div>
            <div className="h-3 rounded-full bg-white border border-zinc-200 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${percentualeUscite}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Saldo anno</p>
            <p className={`font-black text-lg mt-1 ${saldoAnno >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatEuro(saldoAnno)}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Risparmio</p>
            <p className={`font-black text-lg mt-1 ${capacitaRisparmio >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatPercentuale(capacitaRisparmio)}%
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-200 p-4 mt-3">
          <p className="text-xs text-zinc-500">Top spesa anno</p>
          {topSpesa ? (
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="font-black">{topSpesa.categoria}</p>
              <p className="font-black text-red-600">{formatEuro(topSpesa.valore)}</p>
            </div>
          ) : (
            <p className="font-black text-zinc-400 mt-2">Nessuna spesa</p>
          )}
        </div>
      </div>
    );
  }

  function GraficoTorta({
    dati,
    indiceMese,
  }: {
    dati: { categoria: string; valore: number }[];
    indiceMese?: number;
  }) {
    const totaleGrafico = dati.reduce((somma, voce) => somma + voce.valore, 0);
    const mostraDelta = indiceMese !== undefined;

    if (totaleGrafico <= 0) {
      return (
        <div className="rounded-3xl bg-zinc-50 border border-zinc-200 p-5 text-zinc-500 text-sm">
          Nessuna spesa da mostrare.
        </div>
      );
    }

    function badgeDelta(delta: number, label: string) {
      const positivo = delta >= 0;

      return (
        <span
          className={`inline-flex justify-end rounded-full px-2.5 py-1 text-[10px] font-black ${
            positivo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {label} {positivo ? "+" : "-"}
          {formatEuro(Math.abs(delta))}
        </span>
      );
    }

    if (mostraDelta) {
      return (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-sm text-zinc-500">Totale spese mese</p>
              <p className="text-2xl font-black text-red-600 mt-1">
                {formatEuro(totaleGrafico)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1.4fr_0.45fr_0.7fr_0.7fr] gap-2 px-2 text-[11px] font-black text-zinc-400 uppercase">
            <p>Categoria</p>
            <p className="text-right">€</p>
            <p className="text-right">Delta MP</p>
            <p className="text-right">Delta OP</p>
          </div>

          <div className="space-y-1.5">
            {dati.map((voce, index) => {
              const percentuale = (voce.valore / totaleGrafico) * 100;
              const stile = categoriaStile(voce.categoria);
              const budgetMP = budgetAnnualeCategoria(voce.categoria) / 12;
              const deltaMP = budgetMP - voce.valore;
              const budgetOP = budgetOPCategoria(voce.categoria, indiceMese);
              const deltaOP = budgetOP === null ? null : budgetOP - voce.valore;

              return (
                <div
                  key={voce.categoria}
                  className="grid grid-cols-[1.4fr_0.45fr_0.7fr_0.7fr] gap-2 items-center rounded-2xl bg-white border border-zinc-200 p-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${stile.bg} ${stile.bordo}`}
                      >
                        {stile.icona}
                      </div>

                      <div className="min-w-0">
                        <p className="font-black text-sm truncate">{voce.categoria}</p>
                        <p className="text-xs text-zinc-500">
                          {formatPercentuale(percentuale)}% · {formatEuro(voce.valore)}
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(percentuale, 100)}%`,
                          backgroundColor: coloriGrafici[index % coloriGrafici.length],
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-right font-black text-sm text-red-600">
                    {formatEuro(voce.valore)}
                  </p>

                  <div className="text-right">{badgeDelta(deltaMP, "MP")}</div>

                  <div className="text-right">
                    {deltaOP === null ? (
                      <span className="text-[10px] font-black text-zinc-400">Da Mag</span>
                    ) : (
                      badgeDelta(deltaOP, "OP")
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <p className="text-sm text-zinc-500">Totale spese</p>
            <p className="text-2xl font-black mt-1 text-red-600">
              {formatEuro(totaleGrafico)}
            </p>
          </div>

          <p className="text-xs text-zinc-500 text-right">Distribuzione per categoria</p>
        </div>

        {dati.map((voce, index) => {
          const percentuale = (voce.valore / totaleGrafico) * 100;
          const stile = categoriaStile(voce.categoria);

          return (
            <div key={voce.categoria} className="bg-white border border-zinc-200 rounded-lg p-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border ${stile.bg} ${stile.bordo}`}
                  >
                    {stile.icona}
                  </div>

                  <div className="min-w-0">
                    <p className="font-black truncate text-sm">{voce.categoria}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatPercentuale(percentuale)}% del totale
                    </p>
                  </div>
                </div>

                <p className="font-black text-red-600 shrink-0 text-sm">
                  {formatEuro(voce.valore)}
                </p>
              </div>

              <div className="h-2.5 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(percentuale, 100)}%`,
                    backgroundColor: coloriGrafici[index % coloriGrafici.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function MiniTortaSpese({ dati }: { dati: { categoria: string; valore: number }[] }) {
    const totaleGrafico = dati.reduce((somma, voce) => somma + voce.valore, 0);

    if (totaleGrafico <= 0) return null;

    const centroX = 170;
    const centroY = 170;
    const raggio = 145;
    const raggioEmoji = 112;
    let angoloCorrente = -Math.PI / 2;

    const fette = dati.map((voce, index) => {
      const angolo = (voce.valore / totaleGrafico) * Math.PI * 2;
      const angoloFinale = angoloCorrente + angolo;

      const x1 = centroX + raggio * Math.cos(angoloCorrente);
      const y1 = centroY + raggio * Math.sin(angoloCorrente);
      const x2 = centroX + raggio * Math.cos(angoloFinale);
      const y2 = centroY + raggio * Math.sin(angoloFinale);
      const grandeArco = angolo > Math.PI ? 1 : 0;
      const path = `M ${centroX} ${centroY} L ${x1} ${y1} A ${raggio} ${raggio} 0 ${grandeArco} 1 ${x2} ${y2} Z`;
      const metaAngolo = angoloCorrente + angolo / 2;
      const emojiX = centroX + raggioEmoji * Math.cos(metaAngolo);
      const emojiY = centroY + raggioEmoji * Math.sin(metaAngolo);

      angoloCorrente = angoloFinale;

      return {
        path,
        color: coloriGrafici[index % coloriGrafici.length],
        emojiX,
        emojiY,
        icona: categoriaStile(voce.categoria).icona,
      };
    });

    return (
      <div className="rounded-[2rem] bg-white border border-zinc-200 p-6 mt-4 flex flex-col items-center justify-center">
        <p className="text-sm text-zinc-500">Distribuzione spese mese</p>

        <div className="relative mt-4">
          <svg className="w-full max-w-[340px] h-auto" viewBox="0 0 340 340">
            {fette.map((fetta, index) => (
              <g key={index}>
                <path d={fetta.path} fill={fetta.color} />
                <text
                  x={fetta.emojiX}
                  y={fetta.emojiY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="24"
                >
                  {fetta.icona}
                </text>
              </g>
            ))}

            <circle cx="170" cy="170" r="68" fill="white" />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-zinc-500">Totale</p>
            <p className="text-2xl font-black text-red-600 mt-1">
              {formatEuro(totaleGrafico)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function GraficoColonneMesi({
    dati,
  }: {
    dati: { mese: string; entrate: number; uscite: number }[];
  }) {
    const massimo = Math.max(
      1,
      ...dati.map((voce) => Math.max(voce.entrate, voce.uscite))
    );

    return (
      <div className="rounded-[2rem] bg-white border border-zinc-200 p-5 mt-4">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-sm text-zinc-500">Andamento anno</p>
            <p className="font-black mt-1">Entrate e spese mese per mese</p>
          </div>

          <div className="flex gap-4 text-xs font-black">
            <span className="text-emerald-600">Entrate</span>
            <span className="text-red-600">Spese</span>
          </div>
        </div>

        <div className="h-72 flex items-end gap-3 overflow-x-auto pb-2">
          {dati.map((voce) => {
            const altezzaEntrate = Math.max((voce.entrate / massimo) * 220, voce.entrate > 0 ? 12 : 0);
            const altezzaUscite = Math.max((voce.uscite / massimo) * 220, voce.uscite > 0 ? 12 : 0);

            return (
              <div key={voce.mese} className="min-w-[62px] flex flex-col items-center justify-end gap-2">
                <div className="h-[230px] flex items-end justify-center gap-1.5">
                  <div className="flex flex-col items-center justify-end gap-1">
                    <p className="text-[10px] font-black text-emerald-600 rotate-[-45deg] origin-bottom whitespace-nowrap">
                      {voce.entrate > 0 ? formatNumero(voce.entrate) : ""}
                    </p>
                    <div
                      className="w-5 rounded-t-lg bg-emerald-500"
                      style={{ height: `${altezzaEntrate}px` }}
                    />
                  </div>

                  <div className="flex flex-col items-center justify-end gap-1">
                    <p className="text-[10px] font-black text-red-600 rotate-[-45deg] origin-bottom whitespace-nowrap">
                      {voce.uscite > 0 ? formatNumero(voce.uscite) : ""}
                    </p>
                    <div
                      className="w-5 rounded-t-lg bg-red-500"
                      style={{ height: `${altezzaUscite}px` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-zinc-500 font-black">{voce.mese}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function CardPerformanceMensile({
    mese,
    entrate,
    uscite,
    speseCategoria,
  }: {
    mese: string;
    entrate: number;
    uscite: number;
    speseCategoria: { categoria: string; valore: number }[];
  }) {
    const saldo = entrate - uscite;
    const massimo = Math.max(entrate, uscite, 1);
    const percentualeEntrate = Math.min((entrate / massimo) * 100, 100);
    const percentualeUscite = Math.min((uscite / massimo) * 100, 100);
    const capacitaRisparmio = entrate > 0 ? (saldo / entrate) * 100 : 0;
    const topSpesa = speseCategoria[0] || null;
    const statoMese = saldo >= 0 ? "Mese positivo" : "Mese negativo";

    return (
      <div className="rounded-3xl bg-zinc-50 border border-zinc-200 p-5 h-full">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h4 className="text-3xl font-black">{mese} {annoCorrente}</h4>
          </div>

          <div
            className={`px-3 py-2 rounded-full text-xs font-black ${
              saldo >= 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {statoMese}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-black text-emerald-700">Entrate</span>
              <span className="font-black text-emerald-700">{formatEuro(entrate)}</span>
            </div>
            <div className="h-3 rounded-full bg-white border border-zinc-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${percentualeEntrate}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-black text-red-700">Spese</span>
              <span className="font-black text-red-700">{formatEuro(uscite)}</span>
            </div>
            <div className="h-3 rounded-full bg-white border border-zinc-200 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${percentualeUscite}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Saldo mese</p>
            <p className={`font-black text-lg mt-1 ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatEuro(saldo)}
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500">Risparmio</p>
            <p className={`font-black text-lg mt-1 ${capacitaRisparmio >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatPercentuale(capacitaRisparmio)}%
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-200 p-4 mt-3">
          <p className="text-xs text-zinc-500">Top spesa del mese</p>
          {topSpesa ? (
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="font-black">{topSpesa.categoria}</p>
              <p className="font-black text-red-600">{formatEuro(topSpesa.valore)}</p>
            </div>
          ) : (
            <p className="font-black text-zinc-400 mt-2">Nessuna spesa</p>
          )}
        </div>

        <MiniTortaSpese dati={speseCategoria} />
      </div>
    );
  }

  return (
  <main className="min-h-screen bg-[#f5f5f0] text-zinc-950 px-4 sm:px-5 pt-6 pb-36 font-sans tracking-tight">
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-7 rounded-[2.2rem] bg-zinc-950 text-white p-6 shadow-xl shadow-zinc-300/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-zinc-400 text-sm font-medium">Saldo attuale</p>
            <h1 className="text-4xl sm:text-5xl font-black mt-1 tracking-tighter break-words">
              {formatEuro(totale)}
            </h1>
            <p className="text-zinc-400 text-sm mt-3">Gestione personale delle spese</p>
          </div>

          <div className="text-right text-xs font-black text-zinc-400">
            {caricamento ? "Caricamento..." : "Online"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
            <p className="text-xs text-zinc-400">Entrate</p>
            <p className="text-emerald-300 font-bold text-lg mt-1">
              {formatEuro(totaleEntrate)}
            </p>
          </div>

          <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
            <p className="text-xs text-zinc-400">Uscite</p>
            <p className="text-red-300 font-bold text-lg mt-1">
              {formatEuro(totaleUscite)}
            </p>
          </div>
        </div>
      </header>

      {sezione === "recap" && (
        <section>
          <div className="mb-5">
            <h2 className="text-3xl font-black tracking-tight">Recap</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Analisi annuale, mensile e confronto con MP26 / OP
            </p>
          </div>

          <div className="bg-white rounded-[2rem] p-5 border border-zinc-200 shadow-sm mb-4">
            <button
              onClick={() => setRecapAnnualeAperto((aperto) => !aperto)}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-sm text-zinc-500">Anno {annoCorrente}</p>
                <h3 className="text-2xl font-black mt-1">Recap annuale complessivo</h3>
              </div>
              <span className="text-3xl font-black">{recapAnnualeAperto ? "−" : "+"}</span>
            </button>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                <p className="text-xs text-zinc-500">Entrate</p>
                <p className="font-black text-emerald-600 mt-1">
                  {formatEuro(totalePerTipo(movimentiAnnoCorrente(), "entrata"))}
                </p>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                <p className="text-xs text-zinc-500">Spese</p>
                <p className="font-black text-red-600 mt-1">
                  {formatEuro(totalePerTipo(movimentiAnnoCorrente(), "uscita"))}
                </p>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                <p className="text-xs text-zinc-500">Saldo</p>
                <p
                  className={`font-black mt-1 ${
                    totalePerTipo(movimentiAnnoCorrente(), "entrata") -
                      totalePerTipo(movimentiAnnoCorrente(), "uscita") >=
                    0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatEuro(
                    totalePerTipo(movimentiAnnoCorrente(), "entrata") -
                      totalePerTipo(movimentiAnnoCorrente(), "uscita")
                  )}
                </p>
              </div>
            </div>

            {recapAnnualeAperto && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4 items-start">
                  <div className="rounded-[2rem] bg-zinc-50 border border-zinc-200 p-4 h-fit">
                    <div className="flex items-end justify-between gap-4 mb-4">
                      <div>
                        <p className="text-sm text-zinc-500">Totale spese anno</p>
                        <p className="text-2xl font-black text-red-600 mt-1">
                          {formatEuro(totalePerTipo(movimentiAnnoCorrente(), "uscita"))}
                        </p>
                      </div>

                      <p className="text-xs text-zinc-500 text-right">Distribuzione annuale</p>
                    </div>

                    <div className="grid grid-cols-[1.5fr_0.75fr_0.75fr] gap-2 px-2 text-[11px] font-black text-zinc-400 uppercase mb-2">
                      <p>Categoria</p>
                      <p className="text-right">Totale</p>
                      <p className="text-right">Delta MP</p>
                    </div>

                    <div className="space-y-1.5">
                      {spesePerCategoriaDaMovimenti(movimentiAnnoCorrente()).map((voce, index) => {
                        const totaleSpeseAnno = totalePerTipo(movimentiAnnoCorrente(), "uscita");
                        const percentuale = totaleSpeseAnno > 0 ? (voce.valore / totaleSpeseAnno) * 100 : 0;
                        const stile = categoriaStile(voce.categoria);
                        const deltaMP = budgetAnnualeCategoria(voce.categoria) - voce.valore;

                        return (
                          <div
                            key={voce.categoria}
                            className="grid grid-cols-[1.5fr_0.75fr_0.75fr] gap-2 items-center rounded-2xl bg-white border border-zinc-200 p-2.5"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${stile.bg} ${stile.bordo}`}
                                >
                                  {stile.icona}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-black text-sm truncate">{voce.categoria}</p>
                                  <p className="text-xs text-zinc-500">
                                    {formatPercentuale(percentuale)}% del totale
                                  </p>
                                </div>
                              </div>

                              <div className="h-1.5 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden mt-2">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(percentuale, 100)}%`,
                                    backgroundColor: coloriGrafici[index % coloriGrafici.length],
                                  }}
                                />
                              </div>
                            </div>

                            <p className="text-right font-black text-sm text-red-600">
                              {formatEuro(voce.valore)}
                            </p>

                            <p
                              className={`text-right text-[11px] font-black rounded-full px-2 py-1 ${
                                deltaMP >= 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {deltaMP >= 0 ? "+" : "-"}
                              {formatEuro(Math.abs(deltaMP))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <CardPerformanceAnnuale />

                    <div className="rounded-[2rem] bg-zinc-50 border border-zinc-200 p-4">
                      <h4 className="font-black mb-4">Entrate e spese per mese</h4>
                      <GraficoColonneMesi dati={datiLineaAnnuale()} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {mesiAnno.map((mese, index) => {
              const movimentiMese = movimentiDelMese(index);
              const entrateMese = totalePerTipo(movimentiMese, "entrata");
              const usciteMese = totalePerTipo(movimentiMese, "uscita");
              const saldoMese = entrateMese - usciteMese;
              const meseKey = meseCompleto(index);
              const aperto = mesiRecapAperti[meseKey] || false;

              return (
                <div
                  key={meseKey}
                  className={`bg-white rounded-[2rem] p-5 border border-zinc-200 shadow-sm transition-all ${aperto ? "xl:col-span-2" : ""}`}
                >
                  <button
                    onClick={() => toggleMeseRecap(meseKey)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <p className="text-sm text-zinc-500">{mese} {annoCorrente}</p>
                      <h3 className="text-xl font-black mt-1">{mese}</h3>
                    </div>
                    <span className="text-3xl font-black">{aperto ? "−" : "+"}</span>
                  </button>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                      <p className="text-xs text-zinc-500">Entrate</p>
                      <p className="font-black text-emerald-600 mt-1">{formatEuro(entrateMese)}</p>
                    </div>
                    <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                      <p className="text-xs text-zinc-500">Spese</p>
                      <p className="font-black text-red-600 mt-1">{formatEuro(usciteMese)}</p>
                    </div>
                    <div className="rounded-3xl bg-zinc-50 p-3 border border-zinc-200">
                      <p className="text-xs text-zinc-500">Saldo</p>
                      <p className={`font-black mt-1 ${saldoMese >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatEuro(saldoMese)}
                      </p>
                    </div>
                  </div>

                  {aperto && (
                    <div className="mt-5 space-y-5">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-[1.6rem] p-3.5 h-fit">
                          <h4 className="font-black mb-4">Distribuzione spese mensili</h4>
                          <GraficoTorta
                            dati={spesePerCategoriaDaMovimenti(movimentiMese)}
                            indiceMese={index}
                          />
                        </div>

                        <CardPerformanceMensile
                          mese={mese}
                          entrate={entrateMese}
                          uscite={usciteMese}
                          speseCategoria={spesePerCategoriaDaMovimenti(movimentiMese)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sezione === "movimenti" && (
        <section>
          <div className="flex justify-between items-center mb-5 gap-3">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Movimenti</h2>
              <p className="text-zinc-500 text-sm mt-1">Entrate e uscite recenti</p>
            </div>

            <div className="flex gap-2 shrink-0">
              <label className="h-14 px-4 rounded-full bg-white border border-zinc-200 text-zinc-950 text-xs font-black shadow-sm flex items-center justify-center cursor-pointer active:scale-95 transition">
                CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importaCSV(file);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                onClick={apriNuovoMovimento}
                className="w-14 h-14 rounded-full bg-zinc-950 text-white text-3xl font-black shadow-xl shadow-zinc-300 active:scale-95 transition"
              >
                +
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-4 border border-zinc-200 shadow-sm mb-4">
            <p className="text-sm font-black">Importazione CSV</p>
            <p className="text-xs text-zinc-500 mt-1">
              Formato supportato: data, tipo, pagante, versoChi, importo,
              categoria, nota. Supporta anche file separati da punto e virgola.
            </p>
          </div>

          <div className="bg-white rounded-[2rem] p-4 border border-zinc-200 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-black">Filtra per categoria</p>
                <p className="text-xs text-zinc-500 mt-1">Puoi selezionare una o più categorie.</p>
              </div>

              {categorieFiltroMovimenti.length > 0 && (
                <button
                  onClick={() => setCategorieFiltroMovimenti([])}
                  className="text-xs font-black text-zinc-500"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categorieDisponibili.map((categoria) => {
                const stile = categoriaStile(categoria);
                const attiva = categorieFiltroMovimenti.includes(categoria);

                return (
                  <button
                    key={categoria}
                    onClick={() => cambiaFiltroCategoriaMovimenti(categoria)}
                    className={`shrink-0 px-4 py-3 rounded-2xl text-sm font-black border transition ${
                      attiva
                        ? "bg-zinc-950 text-white border-zinc-950"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    <span className="mr-1">{stile.icona}</span>
                    {categoria}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-zinc-500 mt-3">
              Movimenti visualizzati: {formatNumero(movimentiDaMostrare.length)} / {formatNumero(movimenti.length)}
            </p>
          </div>

          <div className="space-y-1.5">
            {movimentiDaMostrare.length === 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-zinc-200 shadow-sm">
                <p className="text-zinc-500">Nessun movimento da mostrare.</p>
              </div>
            )}

            {movimentiDaMostrare.map((movimento) => {
              const stile = categoriaStile(movimento.categoria);

              return (
                <div
                  key={movimento.id}
                  onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
                  onTouchEnd={(e) => gestisciSwipeFine(movimento.id, e.changedTouches[0].clientX)}
                  className="bg-white rounded-[1.35rem] p-4 flex justify-between gap-4 border border-zinc-200 shadow-sm active:scale-[0.98] transition"
                >
                  <div className="min-w-0 flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${stile.bg} ${stile.bordo}`}
                    >
                      {stile.icona}
                    </div>

                    <div className="min-w-0">
                      <p className="font-black text-base truncate">{movimento.categoria || "ALTRO"}</p>

                      <p className="text-sm text-zinc-500 mt-1">{movimento.data}</p>

                      <p className="text-sm text-zinc-500 truncate">
                        {movimento.pagante || "N/D"} → {movimento.versoChi || "N/D"}
                      </p>

                      {movimento.nota && (
                        <p className="text-sm text-zinc-500 mt-2 line-clamp-2">{movimento.nota}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-black text-base ${
                        movimento.tipo === "entrata" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {movimento.tipo === "entrata" ? "+" : "-"}
                      {formatEuro(movimento.importo)}
                    </p>

                    <div className="flex justify-end gap-3 mt-3">
                      <button
                        onClick={() => apriModificaMovimento(movimento)}
                        className="text-xs font-black text-zinc-700"
                      >
                        Modifica
                      </button>

                      <button
                        onClick={() => cancellaMovimento(movimento.id)}
                        className="text-xs font-black text-zinc-400"
                      >
                        Cancella
                      </button>
                    </div>

                    <p className="text-[10px] text-zinc-300 mt-1">swipe ←</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sezione === "categorie" && (
        <section>
          <div className="mb-5">
            <h2 className="text-3xl font-black tracking-tight">Categorie</h2>
            <p className="text-zinc-500 text-sm mt-1">Somma automatica per categoria</p>
          </div>

          <div className="bg-zinc-950 text-white rounded-[1.6rem] p-3 border border-zinc-900 mb-4 shadow-lg shadow-zinc-300/40">
            <p className="text-sm text-zinc-400 mb-3">Periodo</p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "tutto", label: "Tutto" },
                { id: "mese", label: "Mese" },
                { id: "anno", label: "Anno" },
                { id: "personalizzato", label: "Personalizzato" },
              ].map((periodo) => (
                <button
                  key={periodo.id}
                  onClick={() => setFiltroPeriodo(periodo.id as FiltroPeriodo)}
                  className={`p-2.5 rounded-2xl text-sm font-black transition ${
                    filtroPeriodo === periodo.id
                      ? "bg-white text-zinc-950"
                      : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {periodo.label}
                </button>
              ))}
            </div>

            {filtroPeriodo === "personalizzato" && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <input
                  type="date"
                  value={dataInizio}
                  onChange={(e) => setDataInizio(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-white/10 border border-white/10 outline-none text-sm"
                />

                <input
                  type="date"
                  value={dataFine}
                  onChange={(e) => setDataFine(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-white/10 border border-white/10 outline-none text-sm"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {listaCategorie.length === 0 && (
              <div className="col-span-2 bg-white rounded-[2rem] p-6 border border-zinc-200 shadow-sm">
                <p className="text-zinc-500">Nessuna categoria trovata per questo periodo.</p>
              </div>
            )}

            {listaCategorie.map((categoria) => {
              const stile = categoriaStile(categoria.nome);
              const isEntrata = categoria.nome === "ENTRATA";
              const valorePrincipale = isEntrata ? categoria.entrate : categoria.uscite;

              if (!isEntrata && categoria.uscite <= 0) return null;

              return (
                <div key={categoria.nome} className="bg-white rounded-[1.35rem] p-4 border border-zinc-200 shadow-sm">
                  <div className="flex gap-2 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${stile.bg} ${stile.bordo}`}
                    >
                      {stile.icona}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-black truncate text-sm">{categoria.nome}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatNumero(categoria.numeroMovimenti)} movimenti
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-4 rounded-lg p-2 border ${
                      isEntrata
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-red-50 border-red-100"
                    }`}
                  >
                    <p className={`text-xs ${isEntrata ? "text-emerald-700" : "text-red-700"}`}>
                      {isEntrata ? "Entrate totali" : "Spese totali"}
                    </p>
                    <p className={`font-black mt-1 ${isEntrata ? "text-emerald-700" : "text-red-700"}`}>
                      {formatEuro(valorePrincipale)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sezione === "piani" && (
        <section>
          <div className="mb-5">
            <h2 className="text-3xl font-black tracking-tight">Piani</h2>
            <p className="text-zinc-500 text-sm mt-1">Budget annuale generale e piano operativo mensile</p>
          </div>

          <div className="bg-zinc-950 text-white rounded-[2rem] p-5 border border-zinc-900 shadow-xl shadow-zinc-300/50 mb-5">
            <p className="text-zinc-400 text-sm">MP26 · Piano annuale</p>
            <p className="text-3xl font-black mt-2">{formatEuro(budgetAnnualeTotale)}</p>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-zinc-400">Speso anno</p>
                <p className="font-black text-red-300 mt-1">{formatEuro(spesaAnnualeTotale)}</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-zinc-400">Residuo</p>
                <p
                  className={`font-black mt-1 ${
                    budgetAnnualeTotale - spesaAnnualeTotale >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {formatEuro(budgetAnnualeTotale - spesaAnnualeTotale)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-5 border border-zinc-200 shadow-sm mb-5">
            <button
              onClick={() => setPianoAnnualeAperto((aperto) => !aperto)}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <div>
                <h3 className="text-xl font-black mb-1">Budget annuale</h3>
                <p className="text-sm text-zinc-500">Apri la tendina per inserire, modificare o azzerare i valori.</p>
              </div>
              <span className="text-2xl font-black">{pianoAnnualeAperto ? "−" : "+"}</span>
            </button>

            {pianoAnnualeAperto && (
              <div className="grid grid-cols-2 gap-3 mt-5">
                {categorieBudget.map((categoria) => {
                  const stile = categoriaStile(categoria);
                  const budget = budgetAnnualeCategoria(categoria);
                  const speso = spesaAnnualeCategoria(categoria);
                  const residuo = budget - speso;
                  const percentuale = budget > 0 ? Math.min((speso / budget) * 100, 100) : 0;

                  return (
                    <div key={categoria} className="rounded-3xl bg-zinc-50 border border-zinc-200 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stile.bg} ${stile.bordo}`}>
                          {stile.icona}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm truncate">{categoria}</p>
                          <p className="text-xs text-zinc-500">Previsto: {formatEuro(budget)}</p>
                          <p className="text-xs text-zinc-500">Speso: {formatEuro(speso)}</p>
                          <p className={`text-xs font-black mt-1 ${residuo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Residuo: {formatEuro(residuo)}
                          </p>
                        </div>
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[,.]?[0-9]*"
                        value={valoreDraftAnnuale(categoria)}
                        onChange={(e) =>
                          setBudgetAnnualeDraft((correnti) => ({
                            ...correnti,
                            [categoria]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          setBudgetAnnualeDraft((correnti) => ({
                            ...correnti,
                            [categoria]: formatInputImporto(e.target.value),
                          }))
                        }
                        placeholder="€"
                        className="w-full rounded-2xl bg-white border border-zinc-200 p-3 text-right font-black outline-none"
                      />

                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <button onClick={() => confermaBudgetAnnuale(categoria)} className="rounded-2xl bg-zinc-950 text-white py-2 text-xs font-black">
                          Conferma
                        </button>
                        <button onClick={() => modificaBudgetAnnuale(categoria)} className="rounded-2xl bg-white border border-zinc-200 py-2 text-xs font-black text-zinc-600">
                          Modifica
                        </button>
                        <button onClick={() => azzeraBudgetAnnuale(categoria)} className="rounded-2xl bg-red-50 border border-red-100 py-2 text-xs font-black text-red-600">
                          Azzera
                        </button>
                      </div>

                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-zinc-950 rounded-full" style={{ width: `${percentuale}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 text-white rounded-[2rem] p-5 border border-zinc-900 shadow-xl shadow-zinc-300/50 mb-5">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <p className="text-zinc-400 text-sm">OP · Piano operativo mensile</p>
                <p className="text-3xl font-black mt-2">{formatEuro(budgetMensileTotale)}</p>
              </div>

              <input
                type="month"
                value={mesePianoAttivo}
                onChange={(e) => setMesePianoAttivo(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-lg p-2 text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-zinc-400">Speso mese</p>
                <p className="font-black text-red-300 mt-1">{formatEuro(spesaMensileTotale)}</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4 border border-white/10">
                <p className="text-xs text-zinc-400">Residuo</p>
                <p
                  className={`font-black mt-1 ${
                    budgetMensileTotale - spesaMensileTotale >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {formatEuro(budgetMensileTotale - spesaMensileTotale)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-5 border border-zinc-200 shadow-sm">
            <button
              onClick={() => setPianoMensileAperto((aperto) => !aperto)}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <div>
                <h3 className="text-xl font-black mb-1">Budget operativo mese</h3>
                <p className="text-sm text-zinc-500">Apri la tendina per gestire i valori del mese selezionato.</p>
              </div>
              <span className="text-2xl font-black">{pianoMensileAperto ? "−" : "+"}</span>
            </button>

            {pianoMensileAperto && (
              <div className="grid grid-cols-2 gap-3 mt-5">
                {categorieBudget.map((categoria) => {
                  const stile = categoriaStile(categoria);
                  const budget = budgetMensileCategoria(categoria);
                  const speso = spesaMensileCategoria(categoria);
                  const residuo = budget - speso;
                  const percentuale = budget > 0 ? Math.min((speso / budget) * 100, 100) : 0;

                  return (
                    <div key={categoria} className="rounded-3xl bg-zinc-50 border border-zinc-200 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stile.bg} ${stile.bordo}`}>
                          {stile.icona}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm truncate">{categoria}</p>
                          <p className="text-xs text-zinc-500">Previsto: {formatEuro(budget)}</p>
                          <p className="text-xs text-zinc-500">Speso: {formatEuro(speso)}</p>
                          <p className={`text-xs font-black mt-1 ${residuo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Residuo: {formatEuro(residuo)}
                          </p>
                        </div>
                      </div>

                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[,.]?[0-9]*"
                        value={valoreDraftMensile(categoria)}
                        onChange={(e) =>
                          setBudgetMensileDraft((correnti) => ({
                            ...correnti,
                            [categoria]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          setBudgetMensileDraft((correnti) => ({
                            ...correnti,
                            [categoria]: formatInputImporto(e.target.value),
                          }))
                        }
                        placeholder="€"
                        className="w-full rounded-2xl bg-white border border-zinc-200 p-3 text-right font-black outline-none"
                      />

                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <button onClick={() => confermaBudgetMensile(categoria)} className="rounded-2xl bg-zinc-950 text-white py-2 text-xs font-black">
                          Conferma
                        </button>
                        <button onClick={() => modificaBudgetMensile(categoria)} className="rounded-2xl bg-white border border-zinc-200 py-2 text-xs font-black text-zinc-600">
                          Modifica
                        </button>
                        <button onClick={() => azzeraBudgetMensile(categoria)} className="rounded-2xl bg-red-50 border border-red-100 py-2 text-xs font-black text-red-600">
                          Azzera
                        </button>
                      </div>

                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-zinc-950 rounded-full" style={{ width: `${percentuale}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {mostraForm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#f5f5f0] rounded-t-[2rem] sm:rounded-[2rem] p-5 border border-zinc-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-2xl font-black">
                  {movimentoInModifica ? "Modifica movimento" : "Nuovo movimento"}
                </h2>
                <p className="text-sm text-zinc-500">
                  {movimentoInModifica ? "Aggiorna i parametri del movimento" : "Inserisci i dettagli"}
                </p>
              </div>

              <button onClick={annullaInserimento} className="w-10 h-10 rounded-full bg-zinc-950 text-white">
                ×
              </button>
            </div>

            <div className="space-y-1.5">
              <select
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none"
                value={nuovoMovimento.categoria}
                onChange={(e) => {
                  const categoriaSelezionata = e.target.value;

                  setNuovoMovimento({
                    ...nuovoMovimento,
                    categoria: categoriaSelezionata,
                    tipo: categoriaSelezionata === "ENTRATA" ? "entrata" : "uscita",
                  });
                }}
              >
                <option value="">Seleziona categoria</option>
                {categorieDisponibili.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {stileCategorie[categoria].icona} {categoria}
                  </option>
                ))}
              </select>

              <input
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none"
                placeholder="Chi ha pagato"
                value={nuovoMovimento.pagante}
                onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, pagante: e.target.value })}
              />

              <input
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none"
                type="date"
                value={nuovoMovimento.data}
                onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, data: e.target.value })}
              />

              <input
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none"
                placeholder="Verso chi"
                value={nuovoMovimento.versoChi}
                onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, versoChi: e.target.value })}
              />

              <input
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none text-xl font-black"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[,.]?[0-9]*"
                placeholder="Importo"
                value={nuovoMovimento.importo}
                onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, importo: e.target.value })}
                onBlur={(e) =>
                  setNuovoMovimento({
                    ...nuovoMovimento,
                    importo: formatInputImporto(e.target.value),
                  })
                }
              />

              <textarea
                className="w-full p-4 rounded-2xl bg-white border border-zinc-200 outline-none min-h-24"
                placeholder="Nota"
                value={nuovoMovimento.nota}
                onChange={(e) => setNuovoMovimento({ ...nuovoMovimento, nota: e.target.value })}
              />

              <button
                onClick={salvaMovimento}
                disabled={salvataggio}
                className="w-full p-4 rounded-2xl bg-zinc-950 text-white font-black text-lg disabled:opacity-50"
              >
                {salvataggio
                  ? "Salvataggio..."
                  : movimentoInModifica
                  ? "Salva modifiche"
                  : "Salva movimento"}
              </button>

              <button
                onClick={annullaInserimento}
                className="w-full p-4 rounded-2xl bg-white text-zinc-500 border border-zinc-200 font-black"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 px-4 py-5 grid grid-cols-4 gap-2">
        {[
          { id: "recap", label: "Recap" },
          { id: "movimenti", label: "Movimenti" },
          { id: "categorie", label: "Categorie" },
          { id: "piani", label: "Piani" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setSezione(item.id as Sezione)}
            className={`text-sm font-black py-4 rounded-2xl transition ${
              sezione === item.id
                ? "bg-white text-zinc-950"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
     </div>
  </main>
);
}