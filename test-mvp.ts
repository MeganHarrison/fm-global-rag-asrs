#!/usr/bin/env tsx
// Simple test script for MVP - run with: npx tsx test-mvp.ts
import { SimpleFMGlobalAgent } from './chat-handler-mvp';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 FM Global RAG Agent MVP Test\n');
  console.log('=' .repeat(60));

  // Initialize agent
  const agent = new SimpleFMGlobalAgent(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    process.env.OPENAI_API_KEY!
  );

  // Test 1: Simple chat query
  console.log('\n📝 Test 1: Chat Query');
  console.log('-'.repeat(40));
  
  try {
    const response = await agent.handleChatMessage(
      "What are the basic requirements for ASRS sprinkler systems?"
    );
    console.log('✅ Response:', response.content.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Chat failed:', error);
  }

  // Test 2: Design generation
  console.log('\n\n🏗️ Test 2: Design Generation');
  console.log('-'.repeat(40));

  try {
    const design = await agent.generateDesign({
      asrs_type: 'Shuttle',
      container_type: 'Closed-Top',
      rack_depth_ft: 20,
      rack_spacing_ft: 4,
      ceiling_height_ft: 32,
      storage_height_ft: 28,
      system_type: 'wet'
    });

    console.log('✅ Design Results:');
    console.log(`   Sprinklers: ${design.sprinkler_count}`);
    console.log(`   Spacing: ${design.sprinkler_spacing}ft`);
    console.log(`   Cost: $${design.estimated_cost.total.toLocaleString()}`);
    console.log(`   Compliance: ${design.compliance_summary}`);
  } catch (error) {
    console.error('❌ Design generation failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ MVP Test Complete!\n');
}

// Run the test
main().catch(console.error);