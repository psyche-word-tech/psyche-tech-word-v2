import React, { createContext, useContext, useState, ReactNode } from 'react';

const PROD_API_URL = 'https://word-voyage-api-production.up.railway.app';

interface ApiConfigContextType {
  apiBaseUrl: string;
  isConfigLoaded: boolean;
}

const ApiConfigContext = createContext<ApiConfigContextType>({
  apiBaseUrl: PROD_API_URL,
  isConfigLoaded: true,
});

export const useApiConfig = () => useContext(ApiConfigContext);

interface ApiConfigProviderProps {
  children: ReactNode;
}

export const ApiConfigProvider: React.FC<ApiConfigProviderProps> = ({ children }) => {
  const [apiBaseUrl] = useState<string>(PROD_API_URL);
  const [isConfigLoaded] = useState<boolean>(true);

  return (
    <ApiConfigContext.Provider value={{ apiBaseUrl, isConfigLoaded }}>
      {children}
    </ApiConfigContext.Provider>
  );
};
