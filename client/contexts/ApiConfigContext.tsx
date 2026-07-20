import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // 本地开发
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:9091';
    }
    
    // 沙箱预览环境
    if (hostname.includes('coze') || hostname.includes('sandbox')) {
      return '';
    }
    
    // 预览端口 5000（沙箱或生产部署的同端口模式）
    if (port === '5000') {
      return '';
    }
    
    // 其他生产环境（IP 部署等）
    return '';
  }
  
  // SSR / Node.js 环境
  return 'http://localhost:9091';
}

interface ApiConfigContextType {
  apiBaseUrl: string;
  isConfigLoaded: boolean;
}

const ApiConfigContext = createContext<ApiConfigContextType>({
  apiBaseUrl: '',
  isConfigLoaded: false,
});

export const useApiConfig = () => useContext(ApiConfigContext);

interface ApiConfigProviderProps {
  children: ReactNode;
}

export const ApiConfigProvider: React.FC<ApiConfigProviderProps> = ({ children }) => {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

  useEffect(() => {
    setApiBaseUrl(getApiBaseUrl());
    setIsConfigLoaded(true);
  }, []);

  return (
    <ApiConfigContext.Provider value={{ apiBaseUrl, isConfigLoaded }}>
      {children}
    </ApiConfigContext.Provider>
  );
};
