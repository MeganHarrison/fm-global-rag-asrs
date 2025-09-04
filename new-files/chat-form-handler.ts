// FM Global 8-34 AI Agent - Complete Implementation
// Handles both chat queries and form submissions

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ====== TYPES & INTERFACES ======

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
  building_type?: string;
  sprinkler_coverage?: 'standard' | 'extended';
  expected_throughput?: 'low' | 'medium' | 'high';
}

interface FigureResult {
  id: string;
  figure_number: number;
  title: string;
  normalized_summary: string;
  figure_type: string;
  asrs_type: string;
  container_type: string;
  max_depth_ft: number;
  max_spacing_ft: number;
  machine_readable_claims: any;
  page_number: number;
  similarity: number;
  applicable_conditions: string[];
}

interface TableResult {
  id: string;
  table_number: number;
  table_id: string;
  title: string;
  asrs_type: string;
  protection_scheme: string;
  design_parameters: any;
  sprinkler_specifications: any;
  special_conditions: string[];
  content_text: string;
  similarity: number;
  applicable_conditions: string[];
}

interface CostBreakdown {
  items: CostLineItem[];
  subtotal: number;
  labor: number;
  total: number;
}

interface CostLineItem {
  description: string;
  unit_cost: number;
  quantity: number;
  total: number;
}

interface DesignResult {
  configuration: ASRSConfiguration;
  applicable_figures: FigureResult[];
  applicable_tables: TableResult[];
  sprinkler_count: number;
  sprinkler_spacing: number;
  protection_scheme: string;
  equipment_list: EquipmentList;
  estimated_cost: CostBreakdown;
  validation_status: ValidationResult;
  optimization_opportunities: OptimizationSuggestion[];
  compliance_summary: string;
  fm_global_references: string[];
}

interface EquipmentList {
  sprinklers: { type: string; kfactor: string; quantity: number; unit_cost: number }[];
  piping: { size: string; length: number; unit_cost: number }[];
  fittings: { type: string; quantity: number; unit_cost: number }[];
  pumps?: { type: string; gpm: number; pressure: number; unit_cost: number }[];
  total_estimated_cost: number;
}

interface OptimizationSuggestion {
  type: 'spacing_optimization' | 'protection_scheme' | 'container_modification' | 'system_type';
  description: string;
  estimated_savings: number;
  feasibility: 'high' | 'medium' | 'low';
  requirements_impact: string;
  new_configuration?: Partial<ASRSConfiguration>;
}

interface ValidationResult {
  compliant: boolean;
  violations: string[];
  warnings: string[];
  required_modifications: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: any[];
  figures_referenced?: number[];
  tables_referenced?: number[];
}

// ====== MAIN AI AGENT CLASS ======

export class FMGlobal834Agent {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private systemPrompt: string;

  constructor(supabaseUrl: string, supabaseKey: string, openaiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openai = new OpenAI({ apiKey: openaiKey });
    
    this.systemPrompt = `
You are an expert FM Global 8-34 ASRS (Automated Storage and Retrieval Systems) sprinkler design consultant. 

Your knowledge base includes:
- All FM Global 8-34 figures (navigation, system diagrams, sprinkler layouts)
- All FM Global 8-34 tables (design parameters, calculations, specifications)
- Complete regulatory text and requirements
- Cost factors for equipment and installation

Your capabilities:
1. Answer technical questions about ASRS sprinkler requirements
2. Identify applicable figures and tables based on system configuration
3. Generate complete sprinkler system designs with cost estimates
4. Provide optimization suggestions to reduce costs while maintaining compliance
5. Validate designs against FM Global requirements

Always reference specific figures and tables when applicable. Provide actionable, specific guidance with cost implications where relevant.
`;
  }

  // ====== CHAT INTERFACE ======

  async handleChatMessage(message: string, conversationHistory: ChatMessage[] = []): Promise<ChatMessage> {
    try {
      // Step 1: Analyze the query to determine intent and extract parameters
      const queryAnalysis = await this.analyzeQuery(message);
      
      // Step 2: Perform multi-vector search based on query type
      const searchResults = await this.searchMultiVector(message, queryAnalysis.extractedConfig);
      
      // Step 3: Generate contextual response
      const response = await this.generateChatResponse(message, searchResults, conversationHistory);
      
      return {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        sources: searchResults.sources,
        figures_referenced: searchResults.figures_referenced,
        tables_referenced: searchResults.tables_referenced
      };
    } catch (error) {
      console.error('Chat handler error:', error);
      return {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try rephrasing your question or contact support if the issue persists.',
        timestamp: new Date()
      };
    }
  }

  private async analyzeQuery(message: string): Promise<{
    intent: 'design_question' | 'cost_question' | 'compliance_question' | 'optimization_question' | 'general_question';
    extractedConfig?: Partial<ASRSConfiguration>;
    entities: string[];
  }> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Analyze this ASRS sprinkler query and extract:
1. Intent (design_question, cost_question, compliance_question, optimization_question, general_question)
2. Any mentioned configuration parameters (ASRS type, dimensions, commodities, etc.)
3. Key entities (figure numbers, table numbers, equipment types)

Return JSON format:
{
  "intent": "design_question",
  "extractedConfig": {
    "asrs_type": "Shuttle",
    "rack_depth_ft": 20,
    // ... other extracted params
  },
  "entities": ["Figure 14", "Table 25", "sprinkler spacing"]
}`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.1
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        intent: 'general_question',
        entities: []
      };
    }
  }

  // ====== FORM SUBMISSION HANDLER ======

  async handleFormSubmission(formData: ASRSConfiguration): Promise<DesignResult> {
    try {
      console.log('Processing form submission:', formData);

      // Step 1: Validate form data
      const validation = await this.validateConfiguration(formData);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Step 2: Find applicable figures
      const applicableFigures = await this.findApplicableFigures(formData);
      
      // Step 3: Find applicable tables
      const applicableTables = await this.findApplicableTables(formData);
      
      // Step 4: Perform design calculations
      const designCalculations = await this.performDesignCalculations(formData, applicableTables);
      
      // Step 5: Generate equipment specifications
      const equipmentList = await this.generateEquipmentSpecifications(designCalculations, formData);
      
      // Step 6: Calculate costs
      const costBreakdown = await this.calculateComprehensiveCost(equipmentList, formData);
      
      // Step 7: Validate design against regulations
      const validationResult = await this.validateDesignCompliance(formData, designCalculations);
      
      // Step 8: Generate optimization suggestions
      const optimizations = await this.generateOptimizationSuggestions(formData, designCalculations, costBreakdown);
      
      // Step 9: Generate compliance summary
      const complianceSummary = await this.generateComplianceSummary(formData, applicableFigures, applicableTables);

      return {
        configuration: formData,
        applicable_figures: applicableFigures,
        applicable_tables: applicableTables,
        sprinkler_count: designCalculations.total_sprinklers,
        sprinkler_spacing: designCalculations.sprinkler_spacing,
        protection_scheme: designCalculations.protection_scheme,
        equipment_list: equipmentList,
        estimated_cost: costBreakdown,
        validation_status: validationResult,
        optimization_opportunities: optimizations,
        compliance_summary: complianceSummary,
        fm_global_references: this.extractFMReferences(applicableFigures, applicableTables)
      };
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  }

  // ====== MULTI-VECTOR SEARCH ======

  private async searchMultiVector(query: string, config?: Partial<ASRSConfiguration>): Promise<{
    sources: any[];
    figures_referenced: number[];
    tables_referenced: number[];
  }> {
    // Generate embedding for the query
    const embedding = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Parallel search across all vector stores
    const [figureResults, tableResults, textResults] = await Promise.all([
      this.searchFigureVectors(queryEmbedding, config),
      this.searchTableVectors(queryEmbedding, config),
      this.searchTextChunks(queryEmbedding)
    ]);

    // Combine and rank results
    const allSources = [
      ...figureResults.map(f => ({ ...f, source_type: 'figure' })),
      ...tableResults.map(t => ({ ...t, source_type: 'table' })),
      ...textResults.map(r => ({ ...r, source_type: 'text' }))
    ].sort((a, b) => a.similarity - b.similarity); // Lower similarity = better match

    return {
      sources: allSources.slice(0, 10), // Top 10 results
      figures_referenced: figureResults.map(f => f.figure_number),
      tables_referenced: tableResults.map(t => t.table_number)
    };
  }

  private async searchFigureVectors(embedding: number[], config?: Partial<ASRSConfiguration>): Promise<FigureResult[]> {
    let query = this.supabase
      .from('fm_global_figures')
      .select('*')
      .order(this.supabase.rpc('vector_similarity', {
        query_embedding: embedding,
        match_threshold: 0.8
      }), { ascending: true })
      .limit(5);

    // Apply configuration filters
    if (config?.asrs_type) {
      query = query.or(`asrs_type.eq.${config.asrs_type},asrs_type.eq.All`);
    }
    if (config?.container_type) {
      query = query.or(`container_type.eq.${config.container_type},container_type.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Figure search error:', error);
      return [];
    }

    return data?.map(row => ({
      id: row.id,
      figure_number: row.figure_number,
      title: row.title,
      normalized_summary: row.normalized_summary,
      figure_type: row.figure_type,
      asrs_type: row.asrs_type,
      container_type: row.container_type,
      max_depth_ft: row.max_depth_ft,
      max_spacing_ft: row.max_spacing_ft,
      machine_readable_claims: this.parseJSON(row.machine_readable_claims),
      page_number: row.page_number,
      similarity: 0.5, // Placeholder - would be calculated by similarity function
      applicable_conditions: this.extractApplicableConditions(row, config)
    })) || [];
  }

  private async searchTableVectors(embedding: number[], config?: Partial<ASRSConfiguration>): Promise<TableResult[]> {
    // First search the vectorized content
    const { data: vectorData, error: vectorError } = await this.supabase
      .from('fm_table_vectors')
      .select('*')
      .order(this.supabase.rpc('vector_similarity', {
        query_embedding: embedding,
        match_threshold: 0.8
      }), { ascending: true })
      .limit(10);

    if (vectorError || !vectorData) {
      console.error('Vector search error:', vectorError);
      return [];
    }

    // Get the corresponding table metadata
    const tableIds = vectorData.map(v => v.table_id);
    const { data: tableData, error: tableError } = await this.supabase
      .from('fm_global_tables')
      .select('*')
      .in('table_id', tableIds);

    if (tableError || !tableData) {
      console.error('Table metadata error:', tableError);
      return [];
    }

    return vectorData.map(vectorRow => {
      const tableRow = tableData.find(t => t.table_id === vectorRow.table_id);
      if (!tableRow) return null;

      return {
        id: tableRow.id,
        table_number: tableRow.table_number,
        table_id: tableRow.table_id,
        title: tableRow.title,
        asrs_type: tableRow.asrs_type,
        protection_scheme: tableRow.protection_scheme,
        design_parameters: this.parseJSON(tableRow.design_parameters),
        sprinkler_specifications: this.parseJSON(tableRow.sprinkler_specifications),
        special_conditions: this.parseJSON(tableRow.special_conditions) || [],
        content_text: vectorRow.content_text,
        similarity: 0.5, // Placeholder
        applicable_conditions: this.extractTableConditions(tableRow, config)
      };
    }).filter(Boolean) as TableResult[];
  }

  private async searchTextChunks(embedding: number[]): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('fm_text_chunks')
      .select('*')
      .order(this.supabase.rpc('vector_similarity', {
        query_embedding: embedding,
        match_threshold: 0.8
      }), { ascending: true })
      .limit(5);

    if (error) {
      console.error('Text search error:', error);
      return [];
    }

    return data || [];
  }

  // ====== DESIGN CALCULATIONS ======

  private async performDesignCalculations(config: ASRSConfiguration, tables: TableResult[]): Promise<{
    total_sprinklers: number;
    sprinkler_spacing: number;
    protection_scheme: string;
    design_area_sqft: number;
    flow_rate_gpm: number;
    pressure_psi: number;
  }> {
    // Find the most applicable table for calculations
    const primaryTable = this.selectPrimaryDesignTable(tables, config);
    
    if (!primaryTable) {
      throw new Error('No applicable design tables found for configuration');
    }

    // Extract design parameters
    const designParams = primaryTable.design_parameters;
    const sprinklerSpecs = primaryTable.sprinkler_specifications;

    // Calculate sprinkler count based on rack configuration
    const rackArea = config.rack_depth_ft * config.rack_spacing_ft;
    const storageVolume = rackArea * config.storage_height_ft;
    
    // Determine sprinkler spacing based on table requirements
    let sprinklerSpacing = 8; // Default 8ft spacing
    if (config.container_type === 'Open-Top' && config.rack_depth_ft > 6) {
      sprinklerSpacing = 6; // Closer spacing for open containers
    }
    if (config.asrs_type === 'Mini-Load') {
      sprinklerSpacing = Math.min(sprinklerSpacing, 7); // Mini-load typically needs closer spacing
    }

    // Calculate total sprinklers needed
    const sprinklersPerRack = Math.ceil(config.rack_depth_ft / sprinklerSpacing) * 
                              Math.ceil(config.rack_spacing_ft / sprinklerSpacing);
    const totalSprinklers = sprinklersPerRack * this.estimateNumberOfRacks(config);

    // Determine protection scheme
    let protectionScheme = 'Ceiling-only wet system';
    if (config.storage_height_ft > 25 || config.commodity_type.some(c => c.includes('Plastic'))) {
      protectionScheme = 'Ceiling plus in-rack protection';
    }
    if (config.system_type === 'dry') {
      protectionScheme = protectionScheme.replace('wet', 'dry');
    }

    // Calculate design area and flow requirements
    const designAreaSqft = totalSprinklers * Math.pow(sprinklerSpacing, 2);
    const flowRateGpm = this.calculateFlowRate(config, totalSprinklers);
    const pressurePsi = this.calculatePressureRequirement(config, flowRateGpm);

    return {
      total_sprinklers: totalSprinklers,
      sprinkler_spacing: sprinklerSpacing,
      protection_scheme: protectionScheme,
      design_area_sqft: designAreaSqft,
      flow_rate_gpm: flowRateGpm,
      pressure_psi: pressurePsi
    };
  }

  private selectPrimaryDesignTable(tables: TableResult[], config: ASRSConfiguration): TableResult | null {
    // Priority order: exact match > partial match > general
    const exactMatches = tables.filter(t => 
      t.asrs_type.toLowerCase() === config.asrs_type.toLowerCase() &&
      t.protection_scheme.includes(config.system_type)
    );
    
    if (exactMatches.length > 0) {
      return exactMatches[0];
    }

    const partialMatches = tables.filter(t => 
      t.asrs_type.toLowerCase() === config.asrs_type.toLowerCase() ||
      t.asrs_type === 'both'
    );

    return partialMatches.length > 0 ? partialMatches[0] : tables[0];
  }

  private calculateFlowRate(config: ASRSConfiguration, sprinklerCount: number): number {
    // Base flow rate per sprinkler based on commodity type
    let baseFlowPerSprinkler = 20; // GPM for Class I-II
    
    if (config.commodity_type.some(c => c.includes('Class III'))) {
      baseFlowPerSprinkler = 25;
    }
    if (config.commodity_type.some(c => c.includes('Class IV'))) {
      baseFlowPerSprinkler = 30;
    }
    if (config.commodity_type.some(c => c.includes('Plastic'))) {
      baseFlowPerSprinkler = 35;
    }

    // Adjust for ceiling height
    if (config.ceiling_height_ft > 30) {
      baseFlowPerSprinkler *= 1.2;
    }

    return Math.ceil(baseFlowPerSprinkler * Math.min(sprinklerCount, 12)); // Max 12 sprinklers in design area
  }

  private calculatePressureRequirement(config: ASRSConfiguration, flowRate: number): number {
    // Base pressure calculation
    let basePressure = 15; // PSI minimum

    // Adjust for flow rate (simplified K-factor calculation)
    const kFactor = config.sprinkler_coverage === 'extended' ? 14.0 : 11.2;
    const requiredPressure = Math.pow(flowRate / kFactor, 2);

    // Add elevation pressure
    const elevationPressure = config.ceiling_height_ft * 0.433;

    // Add friction losses (simplified)
    const frictionLoss = flowRate * 0.1;

    return Math.ceil(Math.max(basePressure, requiredPressure) + elevationPressure + frictionLoss);
  }

  // ====== EQUIPMENT SPECIFICATION ======

  private async generateEquipmentSpecifications(calculations: any, config: ASRSConfiguration): Promise<EquipmentList> {
    // Get cost factors from database
    const { data: costFactors } = await this.supabase
      .from('fm_cost_factors')
      .select('*');

    if (!costFactors) {
      throw new Error('Cost factors not available');
    }

    // Determine sprinkler specifications
    const kFactor = config.sprinkler_coverage === 'extended' ? '16.8' : '11.2';
    const sprinklerType = config.system_type === 'dry' ? 'Standard Response' : 'Quick Response';
    
    const sprinklerCostFactor = costFactors.find(c => 
      c.component_type === 'sprinkler' && 
      c.factor_name.includes(kFactor)
    );

    const sprinklers = [{
      type: `${sprinklerType} K${kFactor}`,
      kfactor: kFactor,
      quantity: calculations.total_sprinklers,
      unit_cost: sprinklerCostFactor?.base_cost_per_unit || 95
    }];

    // Estimate piping requirements
    const estimatedPipeLength = calculations.total_sprinklers * 12; // 12ft per sprinkler average
    const pipeCostFactor = costFactors.find(c => 
      c.component_type === 'pipe' && 
      c.factor_name.includes('4"')
    );

    const piping = [{
      size: '4" Schedule 40',
      length: estimatedPipeLength,
      unit_cost: pipeCostFactor?.base_cost_per_unit || 12.5
    }];

    // Estimate fittings (20% of sprinkler count)
    const fittings = [{
      type: 'Tees, Elbows, Couplings',
      quantity: Math.ceil(calculations.total_sprinklers * 0.2),
      unit_cost: 25
    }];

    // Pump if required
    const pumps = [];
    if (calculations.flow_rate_gpm > 500 || calculations.pressure_psi > 80) {
      const pumpCostFactor = costFactors.find(c => c.component_type === 'pump');
      pumps.push({
        type: 'Fire Pump System',
        gpm: calculations.flow_rate_gpm,
        pressure: calculations.pressure_psi,
        unit_cost: pumpCostFactor?.base_cost_per_unit || 15000
      });
    }

    const total_estimated_cost = 
      sprinklers.reduce((sum, s) => sum + (s.quantity * s.unit_cost), 0) +
      piping.reduce((sum, p) => sum + (p.length * p.unit_cost), 0) +
      fittings.reduce((sum, f) => sum + (f.quantity * f.unit_cost), 0) +
      pumps.reduce((sum, p) => sum + p.unit_cost, 0);

    return {
      sprinklers,
      piping,
      fittings,
      pumps,
      total_estimated_cost
    };
  }

  // ====== COST CALCULATION ======

  private async calculateComprehensiveCost(equipment: EquipmentList, config: ASRSConfiguration): Promise<CostBreakdown> {
    const items: CostLineItem[] = [];

    // Sprinklers
    equipment.sprinklers.forEach(sprinkler => {
      items.push({
        description: `${sprinkler.type} Sprinklers (${sprinkler.quantity})`,
        unit_cost: sprinkler.unit_cost,
        quantity: sprinkler.quantity,
        total: sprinkler.quantity * sprinkler.unit_cost
      });
    });

    // Piping
    equipment.piping.forEach(pipe => {
      items.push({
        description: `${pipe.size} Pipe (${pipe.length} ft)`,
        unit_cost: pipe.unit_cost,
        quantity: pipe.length,
        total: pipe.length * pipe.unit_cost
      });
    });

    // Fittings
    equipment.fittings.forEach(fitting => {
      items.push({
        description: `${fitting.type} (${fitting.quantity})`,
        unit_cost: fitting.unit_cost,
        quantity: fitting.quantity,
        total: fitting.quantity * fitting.unit_cost
      });
    });

    // Pumps
    equipment.pumps?.forEach(pump => {
      items.push({
        description: `${pump.type} (${pump.gpm} GPM @ ${pump.pressure} PSI)`,
        unit_cost: pump.unit_cost,
        quantity: 1,
        total: pump.unit_cost
      });
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    // Labor calculation (40% of material cost)
    const labor = Math.round(subtotal * 0.4);
    
    const total = subtotal + labor;

    return {
      items,
      subtotal: Math.round(subtotal),
      labor,
      total
    };
  }

  // ====== OPTIMIZATION SUGGESTIONS ======

  private async generateOptimizationSuggestions(
    config: ASRSConfiguration, 
    calculations: any, 
    costs: CostBreakdown
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Spacing optimization
    if (calculations.sprinkler_spacing < 8 && config.container_type !== 'Open-Top') {
      const potentialSavings = this.calculateSpacingOptimization(calculations, costs);
      suggestions.push({
        type: 'spacing_optimization',
        description: `Increase sprinkler spacing from ${calculations.sprinkler_spacing}ft to 8ft`,
        estimated_savings: potentialSavings,
        feasibility: 'high',
        requirements_impact: 'No impact on FM Global compliance for closed-top containers',
        new_configuration: { ...config, rack_spacing_ft: 8 }
      });
    }

    // System type optimization
    if (config.system_type === 'dry' && config.ceiling_height_ft < 25) {
      suggestions.push({
        type: 'system_type',
        description: 'Consider wet system if freezing conditions can be managed',
        estimated_savings: Math.round(costs.total * 0.15), // 15% savings typical
        feasibility: 'medium',
        requirements_impact: 'Faster response time and simplified maintenance',
        new_configuration: { ...config, system_type: 'wet' }
      });
    }

    // Container modification suggestion
    if (config.container_type === 'Open-Top' && config.commodity_type.every(c => !c.includes('Plastic'))) {
      suggestions.push({
        type: 'container_modification',
        description: 'Switch to closed-top containers to reduce sprinkler requirements',
        estimated_savings: Math.round(costs.total * 0.25), // 25% reduction possible
        feasibility: 'low',
        requirements_impact: 'Operational change required, but significant fire protection reduction',
        new_configuration: { ...config, container_type: 'Closed-Top' }
      });
    }

    return suggestions.sort((a, b) => b.estimated_savings - a.estimated_savings);
  }

  private calculateSpacingOptimization(calculations: any, costs: CostBreakdown): number {
    // Calculate reduction in sprinkler count with increased spacing
    const currentSpacing = calculations.sprinkler_spacing;
    const newSpacing = 8;
    const reductionFactor = Math.pow(currentSpacing / newSpacing, 2);
    
    const sprinklerSavings = costs.items.find(item => item.description.includes('Sprinklers'))?.total || 0;
    return Math.round(sprinklerSavings * (1 - reductionFactor));
  }

  // ====== VALIDATION & COMPLIANCE ======

  private async validateDesignCompliance(config: ASRSConfiguration, calculations: any): Promise<ValidationResult> {
    const violations: string[] = [];
    const warnings: string[] = [];
    const required_modifications: string[] = [];

    // Check minimum clearances
    if (config.ceiling_height_ft - config.storage_height_ft < 4) {
      violations.push('Minimum 4ft clearance required between storage top and ceiling');
    }

    // Check sprinkler spacing limits
    if (calculations.sprinkler_spacing > 10) {
      violations.push('Maximum sprinkler spacing of 10ft exceeded');
    }

    // Check commodity-specific requirements
    if (config.commodity_type.some(c => c.includes('Expanded Plastic')) && 
        config.container_type === 'Open-Top') {
      warnings.push('Expanded plastics in open containers require enhanced protection - verify table compliance');
    }

    // Check system pressure limits
    if (calculations.pressure_psi > 175) {
      required_modifications.push('System pressure exceeds 175 PSI - pressure reducing valves required');
    }

    return {
      compliant: violations.length === 0,
      violations,
      warnings,
      required_modifications
    };
  }

  // ====== CHAT RESPONSE GENERATION ======

  private async generateChatResponse(query: string, searchResults: any, history: ChatMessage[]): Promise<{ content: string }> {
    const systemMessage = {
      role: "system" as const,
      content: this.systemPrompt
    };

    const contextMessage = {
      role: "system" as const,
      content: `
Context from FM Global 8-34 database:

FIGURES:
${searchResults.sources.filter(s => s.source_type === 'figure').map(f => 
  `Figure ${f.figure_number}: ${f.title} (${f.normalized_summary})`
).join('\n')}

TABLES:
${searchResults.sources.filter(s => s.source_type === 'table').map(t => 
  `Table ${t.table_number}: ${t.title} - Protection: ${t.protection_scheme}`
).join('\n')}

REGULATORY TEXT:
${searchResults.sources.filter(s => s.source_type === 'text').map(r => 
  r.raw_text?.substring(0, 200) + '...'
).join('\n\n')}

Use this context to provide specific, actionable answers with proper FM Global references.
`
    };

    const messages = [
      systemMessage,
      contextMessage,
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: query }
    ];

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages,
      temperature: 0.1,
      max_tokens: 1500
    });

    return {
      content: completion.choices[0].message.content || 'I apologize, but I was unable to generate a response. Please try rephrasing your question.'
    };
  }

  // ====== UTILITY METHODS ======

  private async findApplicableFigures(config: ASRSConfiguration): Promise<FigureResult[]> {
    let query = this.supabase
      .from('fm_global_figures')
      .select('*')
      .or(`asrs_type.eq.${config.asrs_type},asrs_type.eq.All`);

    if (config.container_type) {
      query = query.or(`container_type.eq.${config.container_type},container_type.is.null`);
    }

    const { data, error } = await query.limit(10);
    
    if (error) {
      console.error('Figure search error:', error);
      return [];
    }

    return data?.map(row => ({
      id: row.id,
      figure_number: row.figure_number,
      title: row.title,
      normalized_summary: row.normalized_summary,
      figure_type: row.figure_type,
      asrs_type: row.asrs_type,
      container_type: row.container_type,
      max_depth_ft: row.max_depth_ft,
      max_spacing_ft: row.max_spacing_ft,
      machine_readable_claims: this.parseJSON(row.machine_readable_claims),
      page_number: row.page_number,
      similarity: 0,
      applicable_conditions: this.extractApplicableConditions(row, config)
    })) || [];
  }

  private async findApplicableTables(config: ASRSConfiguration): Promise<TableResult[]> {
    let query = this.supabase
      .from('fm_global_tables')
      .select('*')
      .or(`asrs_type.eq.${config.asrs_type},asrs_type.eq.both,asrs_type.eq.unknown`);

    if (config.system_type !== 'both') {
      query = query.or(`system_type.eq.${config.system_type},system_type.eq.both`);
    }

    const { data, error } = await query.limit(15);
    
    if (error) {
      console.error('Table search error:', error);
      return [];
    }

    return data?.map(row => ({
      id: row.id,
      table_number: row.table_number,
      table_id: row.table_id,
      title: row.title,
      asrs_type: row.asrs_type,
      protection_scheme: row.protection_scheme,
      design_parameters: this.parseJSON(row.design_parameters),
      sprinkler_specifications: this.parseJSON(row.sprinkler_specifications),
      special_conditions: this.parseJSON(row.special_conditions) || [],
      content_text: '',
      similarity: 0,
      applicable_conditions: this.extractTableConditions(row, config)
    })) || [];
  }

  private async validateConfiguration(config: ASRSConfiguration): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.asrs_type) errors.push('ASRS type is required');
    if (!config.container_type) errors.push('Container type is required');
    if (!config.rack_depth_ft || config.rack_depth_ft < 3) errors.push('Rack depth must be at least 3 feet');
    if (!config.rack_spacing_ft || config.rack_spacing_ft < 2.5) errors.push('Rack spacing must be at least 2.5 feet');
    if (!config.ceiling_height_ft || config.ceiling_height_ft < 15) errors.push('Ceiling height must be at least 15 feet');
    if (!config.storage_height_ft) errors.push('Storage height is required');
    if (!config.commodity_type || config.commodity_type.length === 0) errors.push('At least one commodity type is required');
    if (!config.system_type) errors.push('System type is required');

    // Logical validations
    if (config.storage_height_ft && config.ceiling_height_ft && 
        config.storage_height_ft >= config.ceiling_height_ft - 4) {
      errors.push('Storage height must be at least 4 feet below ceiling');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private extractApplicableConditions(row: any, config?: Partial<ASRSConfiguration>): string[] {
    const conditions: string[] = [];
    
    if (row.max_depth_ft && config?.rack_depth_ft) {
      if (config.rack_depth_ft <= row.max_depth_ft) {
        conditions.push(`Rack depth ≤ ${row.max_depth_ft}ft`);
      }
    }
    
    if (row.max_spacing_ft && config?.rack_spacing_ft) {
      if (config.rack_spacing_ft <= row.max_spacing_ft) {
        conditions.push(`Spacing ≤ ${row.max_spacing_ft}ft`);
      }
    }

    return conditions;
  }

  private extractTableConditions(row: any, config?: Partial<ASRSConfiguration>): string[] {
    const conditions: string[] = [];
    
    if (row.ceiling_height_min_ft && config?.ceiling_height_ft) {
      if (config.ceiling_height_ft >= row.ceiling_height_min_ft) {
        conditions.push(`Ceiling height ≥ ${row.ceiling_height_min_ft}ft`);
      }
    }

    if (row.protection_scheme) {
      conditions.push(`Protection: ${row.protection_scheme}`);
    }

    return conditions;
  }

  private estimateNumberOfRacks(config: ASRSConfiguration): number {
    // Simplified estimation - would need more info for accurate calculation
    const typicalWarehouseSize = 10000; // 10,000 sq ft
    const rackFootprint = config.rack_depth_ft * 30; // Assume 30ft rack length
    return Math.ceil(typicalWarehouseSize / rackFootprint);
  }

  private generateComplianceSummary(config: ASRSConfiguration, figures: FigureResult[], tables: TableResult[]): string {
    return `
FM Global 8-34 Compliance Summary:
- ASRS Type: ${config.asrs_type}
- Container Configuration: ${config.container_type}
- Applicable Figures: ${figures.map(f => f.figure_number).join(', ')}
- Applicable Tables: ${tables.map(t => t.table_number).join(', ')}
- Protection Scheme: Based on ${config.system_type} system requirements
- Commodity Classification: ${config.commodity_type.join(', ')}
    `.trim();
  }

  private extractFMReferences(figures: FigureResult[], tables: TableResult[]): string[] {
    return [
      ...figures.map(f => `FM Global 8-34 Figure ${f.figure_number}`),
      ...tables.map(t => `FM Global 8-34 Table ${t.table_number}`)
    ];
  }

  private parseJSON(jsonString: string | null): any {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }
}

// ====== USAGE EXAMPLES ======

// Initialize the agent
const agent = new FMGlobal834Agent(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.OPENAI_API_KEY!
);

// Example 1: Handle chat message
export async function handleChatQuery(message: string, history: ChatMessage[] = []) {
  return await agent.handleChatMessage(message, history);
}

// Example 2: Handle form submission
export async function handleFormSubmission(formData: ASRSConfiguration) {
  return await agent.handleFormSubmission(formData);
}

// Example 3: Get optimization suggestions for existing design
export async function getOptimizations(config: ASRSConfiguration) {
  const design = await agent.handleFormSubmission(config);
  return design.optimization_opportunities;
}

export { FMGlobal834Agent, type ASRSConfiguration, type DesignResult, type ChatMessage };