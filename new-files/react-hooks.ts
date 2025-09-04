// React Hooks for FM Global 8-34 API Integration

import { useState, useCallback, useEffect } from 'react';

// ====== TYPES ======

interface ASRSConfiguration {
  asrs_type: 'Shuttle' | 'Mini-Load' | 'Horizontal Carousel';
  container_type: 'Closed-Top' | 'Open-Top' | 'Mixed';
  rack_depth_ft: number;
  rack_spacing_ft: number;
  ceiling_height_ft: number;
  aisle_width_ft: number;
  commodity_type: string[];
  storage_height_ft: number;
  system_type: 'wet' | 'dry' | 'both';
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: any[];
  figures_referenced?: number[];
  tables_referenced?: number[];
}

interface DesignResult {
  configuration: ASRSConfiguration;
  applicable_figures: any[];
  applicable_tables: any[];
  sprinkler_count: number;
  sprinkler_spacing: number;
  protection_scheme: string;
  equipment_list: any;
  estimated_cost: any;
  validation_status: any;
  optimization_opportunities: any[];
  compliance_summary: string;
  fm_global_references: string[];
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// ====== API CLIENT ======

class FMGlobalAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError({
        message: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        code: errorData.code
      });
    }

    return response.json();
  }

  // Chat endpoints
  async sendChatMessage(message: string, history: ChatMessage[] = []): Promise<{ response: ChatMessage }> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  }

  async getChatSuggestions(configuration?: Partial<ASRSConfiguration>): Promise<{ suggestions: string[] }> {
    return this.request('/chat/suggestions', {
      method: 'POST',
      body: JSON.stringify({ configuration }),
    });
  }

  // Design endpoints
  async generateDesign(configuration: ASRSConfiguration): Promise<{ design: DesignResult; lead_score: number }> {
    return this.request('/design', {
      method: 'POST',
      body: JSON.stringify(configuration),
    });
  }

  async validateConfiguration(configuration: Partial<ASRSConfiguration>): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return this.request('/validate', {
      method: 'POST',
      body: JSON.stringify(configuration),
    });
  }

  async getCostEstimate(configuration: ASRSConfiguration): Promise<{
    estimate: any;
    confidence_level: string;
  }> {
    return this.request('/cost-estimate', {
      method: 'POST',
      body: JSON.stringify(configuration),
    });
  }

  // Search endpoints
  async searchFigures(params: any): Promise<{ figures: any[]; count: number }> {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/figures/search?${queryString}`);
  }

  async searchTables(params: any): Promise<{ tables: any[]; count: number }> {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/tables/search?${queryString}`);
  }

  // Optimization endpoints
  async getOptimizations(configuration: ASRSConfiguration): Promise<{
    optimizations: any[];
    potential_savings: number;
  }> {
    return this.request('/optimize', {
      method: 'POST',
      body: JSON.stringify({ configuration }),
    });
  }

  // Lead endpoints
  async submitLead(leadData: any): Promise<{
    lead_id: string;
    lead_score: number;
    message: string;
  }> {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  }
}

class ApiError extends Error {
  status?: number;
  code?: string;

  constructor({ message, status, code }: { message: string; status?: number; code?: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ====== HOOKS ======

// Chat Hook
export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const apiClient = new FMGlobalAPIClient();

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.sendChatMessage(message, messages.slice(-10));
      setMessages(prev => [...prev, response.response]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [messages, apiClient]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const loadSuggestions = useCallback(async (configuration?: Partial<ASRSConfiguration>) => {
    try {
      const response = await apiClient.getChatSuggestions(configuration);
      setSuggestions(response.suggestions);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  }, [apiClient]);

  return {
    messages,
    isLoading,
    error,
    suggestions,
    sendMessage,
    clearMessages,
    loadSuggestions,
  };
};

// Design Hook
export const useDesign = () => {
  const [design, setDesign] = useState<DesignResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);

  const apiClient = new FMGlobalAPIClient();

  const generateDesign = useCallback(async (configuration: ASRSConfiguration) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.generateDesign(configuration);
      setDesign(response.design);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate design';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [apiClient]);

  const validateConfiguration = useCallback(async (configuration: Partial<ASRSConfiguration>) => {
    try {
      const response = await apiClient.validateConfiguration(configuration);
      setValidation(response);
      return response;
    } catch (err) {
      console.error('Validation failed:', err);
      return { valid: false, errors: ['Validation failed'], warnings: [] };
    }
  }, [apiClient]);

  const getCostEstimate = useCallback(async (configuration: ASRSConfiguration) => {
    try {
      return await apiClient.getCostEstimate(configuration);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Cost estimation failed');
    }
  }, [apiClient]);

  const clearDesign = useCallback(() => {
    setDesign(null);
    setError(null);
    setValidation(null);
  }, []);

  return {
    design,
    isGenerating,
    error,
    validation,
    generateDesign,
    validateConfiguration,
    getCostEstimate,
    clearDesign,
  };
};

// Form Hook
export const useASRSForm = () => {
  const [formData, setFormData] = useState<Partial<ASRSConfiguration>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = [
    {
      key: 'asrs_type',
      label: 'ASRS Type',
      type: 'select',
      options: [
        { value: 'Shuttle', label: 'Shuttle ASRS' },
        { value: 'Mini-Load', label: 'Mini-Load ASRS' },
        { value: 'Horizontal Carousel', label: 'Horizontal Carousel' },
      ],
      required: true,
    },
    {
      key: 'container_type',
      label: 'Container Type',
      type: 'select',
      options: [
        { value: 'Closed-Top', label: 'Closed-Top Containers' },
        { value: 'Open-Top', label: 'Open-Top Containers' },
        { value: 'Mixed', label: 'Mixed Container Types' },
      ],
      required: true,
    },
    {
      key: 'rack_depth_ft',
      label: 'Rack Depth (feet)',
      type: 'number',
      min: 3,
      max: 30,
      step: 0.5,
      required: true,
    },
    {
      key: 'rack_spacing_ft',
      label: 'Rack Spacing (feet)',
      type: 'number',
      min: 2.5,
      max: 10,
      step: 0.5,
      required: true,
    },
    {
      key: 'ceiling_height_ft',
      label: 'Ceiling Height (feet)',
      type: 'number',
      min: 15,
      max: 50,
      required: true,
    },
    {
      key: 'storage_height_ft',
      label: 'Storage Height (feet)',
      type: 'number',
      min: 8,
      max: 45,
      required: true,
    },
    {
      key: 'commodity_type',
      label: 'Commodity Types',
      type: 'multiselect',
      options: [
        { value: 'Class I', label: 'Class I Commodities' },
        { value: 'Class II', label: 'Class II Commodities' },
        { value: 'Class III', label: 'Class III Commodities' },
        { value: 'Class IV', label: 'Class IV Commodities' },
        { value: 'Cartoned Unexpanded Plastics', label: 'Cartoned Unexpanded Plastics' },
        { value: 'Cartoned Expanded Plastics', label: 'Cartoned Expanded Plastics' },
      ],
      required: true,
    },
    {
      key: 'system_type',
      label: 'System Type',
      type: 'select',
      options: [
        { value: 'wet', label: 'Wet System' },
        { value: 'dry', label: 'Dry System' },
        { value: 'both', label: 'Both/Uncertain' },
      ],
      required: true,
    },
  ];

  const updateField = useCallback((key: keyof ASRSConfiguration, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }, [errors]);

  const validateStep = useCallback((stepIndex: number) => {
    const question = questions[stepIndex];
    const value = formData[question.key as keyof ASRSConfiguration];
    
    if (question.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))) {
      setErrors(prev => ({ ...prev, [question.key]: `${question.label} is required` }));
      return false;
    }

    // Custom validations
    if (question.key === 'storage_height_ft' && formData.ceiling_height_ft) {
      const storageHeight = value as number;
      const ceilingHeight = formData.ceiling_height_ft;
      if (storageHeight >= ceilingHeight - 4) {
        setErrors(prev => ({ 
          ...prev, 
          [question.key]: 'Storage height must be at least 4 feet below ceiling' 
        }));
        return false;
      }
    }

    return true;
  }, [formData, questions]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, questions.length - 1));
    }
  }, [currentStep, validateStep, questions.length]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const submitForm = useCallback(async () => {
    // Validate all fields
    let isValid = true;
    questions.forEach((question, index) => {
      if (!validateStep(index)) {
        isValid = false;
      }
    });

    if (!isValid) return null;

    setIsSubmitting(true);
    
    try {
      const apiClient = new FMGlobalAPIClient();
      const result = await apiClient.generateDesign(formData as ASRSConfiguration);
      return result;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Form submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, questions, validateStep]);

  const resetForm = useCallback(() => {
    setFormData({});
    setCurrentStep(0);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const isCurrentStepValid = currentQuestion ? !errors[currentQuestion.key] && 
    (formData[currentQuestion.key as keyof ASRSConfiguration] !== undefined) : false;

  return {
    formData,
    currentStep,
    currentQuestion,
    questions,
    errors,
    isSubmitting,
    progress,
    isCurrentStepValid,
    updateField,
    nextStep,
    prevStep,
    submitForm,
    resetForm,
    validateStep,
  };
};

// Search Hook
export const useSearch = () => {
  const [figures, setFigures] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = new FMGlobalAPIClient();

  const searchFigures = useCallback(async (params: any) => {
    setIsSearching(true);
    setError(null);

    try {
      const response = await apiClient.searchFigures(params);
      setFigures(response.figures);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Figure search failed');
      return { figures: [], count: 0 };
    } finally {
      setIsSearching(false);
    }
  }, [apiClient]);

  const searchTables = useCallback(async (params: any) => {
    setIsSearching(true);
    setError(null);

    try {
      const response = await apiClient.searchTables(params);
      setTables(response.tables);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Table search failed');
      return { tables: [], count: 0 };
    } finally {
      setIsSearching(false);
    }
  }, [apiClient]);

  const clearResults = useCallback(() => {
    setFigures([]);
    setTables([]);
    setError(null);
  }, []);

  return {
    figures,
    tables,
    isSearching,
    error,
    searchFigures,
    searchTables,
    clearResults,
  };
};

// Optimization Hook
export const useOptimization = () => {
  const [optimizations, setOptimizations] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = new FMGlobalAPIClient();

  const analyzeOptimizations = useCallback(async (configuration: ASRSConfiguration) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await apiClient.getOptimizations(configuration);
      setOptimizations(response.optimizations);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization analysis failed');
      return { optimizations: [], potential_savings: 0 };
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiClient]);

  const clearOptimizations = useCallback(() => {
    setOptimizations([]);
    setError(null);
  }, []);

  return {
    optimizations,
    isAnalyzing,
    error,
    analyzeOptimizations,
    clearOptimizations,
  };
};

// Lead Hook
export const useLead = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const apiClient = new FMGlobalAPIClient();

  const submitLead = useCallback(async (leadData: any) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.submitLead(leadData);
      setSubmissionResult(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lead submission failed');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [apiClient]);

  const clearLead = useCallback(() => {
    setSubmissionResult(null);
    setError(null);
  }, []);

  return {
    isSubmitting,
    error,
    submissionResult,
    submitLead,
    clearLead,
  };
};

// Combined hook for the complete application
export const useFMGlobalApp = () => {
  const chat = useChat();
  const design = useDesign();
  const form = useASRSForm();
  const search = useSearch();
  const optimization = useOptimization();
  const lead = useLead();

  return {
    chat,
    design,
    form,
    search,
    optimization,
    lead,
  };
};

export {
  FMGlobalAPIClient,
  ApiError,
  type ASRSConfiguration,
  type ChatMessage,
  type DesignResult,
};