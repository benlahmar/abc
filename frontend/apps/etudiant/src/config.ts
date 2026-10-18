import { createContext, useContext } from 'react';

/** Configuration propre à chaque environnement (config.json), avec l'identité de l'établissement. */
export interface AppConfig {
  apiUrl: string;
  issuer: string;
  clientId: string;
  university: string;
  faculty: string;
  shortName: string;
  city: string;
}

export const DEMO_CONFIG: AppConfig = {
  apiUrl: '', issuer: '', clientId: 'demo', university: 'Université Hassan II de Casablanca',
  faculty: 'Faculté des Sciences Ben M\'Sick', shortName: 'FSBM', city: 'Casablanca',
};

export const ConfigContext = createContext<AppConfig>(DEMO_CONFIG);
export const useConfig = () => useContext(ConfigContext);
