// Simple test script for the RAG chat MVP
import dotenv from 'dotenv';
import { FMGlobal834Agent } from './chat-form-handler';

dotenv.config();

async function testChat() {
  console.log('🔧 Initializing FM Global RAG Agent...\n');
  
  const agent = new FMGlobal834Agent(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.OPENAI_API_KEY!
  );

  // Test queries
  const testQueries = [
    "What are the sprinkler spacing requirements for a shuttle ASRS with closed-top containers?",
    "How many sprinklers do I need for a 20ft deep rack system?",
    "What's the difference between wet and dry systems for ASRS protection?",
    "Can you estimate the cost for a mini-load ASRS system with 30ft ceiling height?"
  ];

  console.log('📝 Testing chat functionality:\n');
  console.log('=' .repeat(60));

  for (const query of testQueries) {
    console.log(`\n❓ Question: ${query}\n`);
    
    try {
      const response = await agent.handleChatMessage(query);
      console.log(`✅ Answer: ${response.content}\n`);
      
      if (response.figures_referenced?.length > 0) {
        console.log(`📊 Referenced Figures: ${response.figures_referenced.join(', ')}`);
      }
      if (response.tables_referenced?.length > 0) {
        console.log(`📋 Referenced Tables: ${response.tables_referenced.join(', ')}`);
      }
      
      console.log('-'.repeat(60));
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test design generation
  console.log('\n\n📐 Testing design generation:\n');
  console.log('='.repeat(60));

  const testConfig = {
    asrs_type: 'Shuttle' as const,
    container_type: 'Closed-Top' as const,
    rack_depth_ft: 20,
    rack_spacing_ft: 4,
    ceiling_height_ft: 32,
    aisle_width_ft: 8,
    commodity_type: ['Class II Commodities'],
    storage_height_ft: 28,
    system_type: 'wet' as const
  };

  try {
    console.log('Configuration:', JSON.stringify(testConfig, null, 2));
    const design = await agent.handleFormSubmission(testConfig);
    
    console.log('\n✅ Design Generated Successfully!');
    console.log(`- Total Sprinklers: ${design.sprinkler_count}`);
    console.log(`- Sprinkler Spacing: ${design.sprinkler_spacing}ft`);
    console.log(`- Protection Scheme: ${design.protection_scheme}`);
    console.log(`- Estimated Cost: $${design.estimated_cost.total.toLocaleString()}`);
    console.log(`- Compliance: ${design.validation_status.compliant ? '✓ Compliant' : '✗ Non-compliant'}`);
    
    if (design.optimization_opportunities.length > 0) {
      console.log('\n💡 Optimization Opportunities:');
      design.optimization_opportunities.forEach(opt => {
        console.log(`  - ${opt.description} (Save: $${opt.estimated_savings.toLocaleString()})`);
      });
    }
  } catch (error) {
    console.error(`❌ Design Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the test
testChat().then(() => {
  console.log('\n✨ Test completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});