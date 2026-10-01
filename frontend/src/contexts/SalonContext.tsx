import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { publicApi } from '@services/api';

/**
 * Dados do salão — nome da marca, endereço, contato, horário.
 *
 * A marca é UM dado, não um literal. Antes cada tela repetia "MR. CUT"
 * escrito no arquivo: header público, sidebar dos painéis, rodapé, login e
 * título da aba. Trocar o nome nas Configurações mudava a landing e nada
 * mais — o resto do site continuava com o nome antigo.
 *
 * Todos leem daqui. Para o nome mudar no site inteiro, basta salvar em
 * Configurações: `refreshSalon()` é chamado depois do save.
 */
export interface PublicSalon {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  businessHours: Record<string, { open: string; close: string } | null>;
}

interface SalonContextValue {
  salon: PublicSalon | null;
  loading: boolean;
  refreshSalon: () => Promise<void>;
}

const SalonContext = createContext<SalonContextValue | undefined>(undefined);

/**
 * A mesma requisição serve todas as telas. Sem isto, trocar de página
 * dispararia um GET /salon por navegação — e o header, a sidebar e o
 * rodapé mounted ao mesmo tempo fariam três de uma vez.
 */
let inFlight: Promise<PublicSalon | null> | null = null;

function loadSalon(): Promise<PublicSalon | null> {
  if (!inFlight) {
    inFlight = publicApi
      .getSalon()
      .then((r) => r.salon)
      .catch(() => null);
  }
  return inFlight;
}

/** Usado pelo dono logo após salvar: descarta o cache e busca de novo. */
export function invalidateSalonCache(): void {
  inFlight = null;
}

export function SalonProvider({ children }: { children: ReactNode }) {
  const [salon, setSalon] = useState<PublicSalon | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSalon = useCallback(async () => {
    invalidateSalonCache();
    setLoading(true);
    const data = await loadSalon();
    setSalon(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;

    void loadSalon().then((data) => {
      if (!alive) return;
      setSalon(data);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  // O título da aba é a marca também. O index.html traz um texto genérico
  // porque HTML estático não tem acesso ao banco.
  useEffect(() => {
    if (salon?.name) {
      document.title = salon.name;
    }
  }, [salon?.name]);

  return (
    <SalonContext.Provider value={{ salon, loading, refreshSalon }}>
      {children}
    </SalonContext.Provider>
  );
}

export function useSalon(): SalonContextValue {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error('useSalon deve ser usado dentro de SalonProvider');
  return ctx;
}

/**
 * Nome da marca para exibir.
 *
 * Enquanto o GET não volta, devolve string vazia em vez de um literal: os
 * componentes reservam o espaço com `min-w-0`/altura fixa, então não há
 * salto de layout quando o nome entra. Chamar isso antes do fetchfaria a
 * tela mostrar a marca antiga — que é justamente o bug que estamos
 * corrigindo.
 */
export function useSalonName(): { name: string; loading: boolean } {
  const { salon, loading } = useSalon();
  return { name: salon?.name ?? '', loading };
}