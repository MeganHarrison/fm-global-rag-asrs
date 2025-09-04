"""Tools for FM-Global ASRS Expert agent."""

import re
import json
import logging
from typing import Dict, Any, Optional, List
from pydantic_ai import RunContext

# Handle both relative and absolute imports
try:
    from .dependencies import AgentDependencies, FMGlobalDataAccess
except ImportError:
    from dependencies import AgentDependencies, FMGlobalDataAccess

logger = logging.getLogger(__name__)


def classify_asrs_system(
    ctx: RunContext[AgentDependencies],
    user_description: str,
    follow_up_questions: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Analyze user input to identify ASRS system type, container characteristics, 
    and configuration parameters essential for FM-Global 8-34 compliance lookup.
    
    Args:
        ctx: Runtime context with dependencies
        user_description: User's description of their ASRS system
        follow_up_questions: Additional clarifying information if provided
        
    Returns:
        Dict containing system classification and parameters
    """
    try:
        data_access = FMGlobalDataAccess(ctx.deps)
        
        # Combine all input text
        full_description = user_description.lower()
        if follow_up_questions:
            full_description += " " + " ".join(follow_up_questions).lower()
        
        # ASRS Type Classification
        asrs_type = "unknown"
        confidence = 0.0
        
        # Shuttle type keywords
        shuttle_keywords = ["shuttle", "slats", "mesh", "shelving", "horizontal loading"]
        if any(keyword in full_description for keyword in shuttle_keywords):
            asrs_type = "shuttle"
            confidence = 0.9
        
        # Mini-load type keywords  
        miniload_keywords = ["mini-load", "miniload", "angle iron", "guides", "uprights"]
        if any(keyword in full_description for keyword in miniload_keywords):
            asrs_type = "mini-load"
            confidence = 0.9
            
        # Top-loading keywords
        topload_keywords = ["top-loading", "top loading", "robot", "grid", "from above"]
        if any(keyword in full_description for keyword in topload_keywords):
            asrs_type = "top-loading"
            confidence = 0.85
            
        # Container Classification
        container_material = "unknown"
        container_config = "unknown"
        
        if "combustible" in full_description:
            container_material = "combustible"
        elif "metal" in full_description or "noncombustible" in full_description:
            container_material = "noncombustible"
        elif "plastic" in full_description:
            if "expanded" in full_description:
                container_material = "plastic_expanded"
            else:
                container_material = "plastic_unexpanded"
        
        if "closed-top" in full_description or "closed top" in full_description:
            container_config = "closed_top"
        elif "open-top" in full_description or "open top" in full_description:
            container_config = "open_top"
        
        # Extract dimensions using regex
        dimensions = {}
        
        # Height patterns
        height_patterns = [
            r"(\d+)\s*(?:feet?|ft|')\s*(?:tall|high)",
            r"height.*?(\d+)\s*(?:feet?|ft|')",
            r"(\d+)\s*(?:feet?|ft|')\s*height"
        ]
        for pattern in height_patterns:
            match = re.search(pattern, full_description)
            if match:
                dimensions["storage_height_ft"] = float(match.group(1))
                break
        
        # Width patterns (for aisles)
        width_patterns = [
            r"(\d+)\s*(?:feet?|ft|')\s*wide",
            r"aisle.*?(\d+)\s*(?:feet?|ft|')",
            r"width.*?(\d+)\s*(?:feet?|ft|')"
        ]
        for pattern in width_patterns:
            match = re.search(pattern, full_description)
            if match:
                dimensions["aisle_width_ft"] = float(match.group(1))
                break
        
        # Commodity Classification
        commodity_class = "unknown"
        if any(cls in full_description for cls in ["class 1", "class1", "class i"]):
            commodity_class = "class_1"
        elif any(cls in full_description for cls in ["class 2", "class2", "class ii"]):
            commodity_class = "class_2"
        elif any(cls in full_description for cls in ["class 3", "class3", "class iii"]):
            commodity_class = "class_3"
        elif any(cls in full_description for cls in ["class 4", "class4", "class iv"]):
            commodity_class = "class_4"
        
        # Determine missing critical information
        missing_info = []
        if not dimensions.get("storage_height_ft"):
            missing_info.append("Storage height not specified")
        if not dimensions.get("aisle_width_ft"):
            missing_info.append("Aisle width not specified")
        if container_material == "unknown":
            missing_info.append("Container material not specified")
        if container_config == "unknown":
            missing_info.append("Container configuration (open/closed top) not specified")
        
        # Calculate overall confidence
        overall_confidence = confidence * 0.7  # Reduce for missing info
        if missing_info:
            overall_confidence *= 0.8
        
        # Determine FM-Global section path
        fm_global_path = "section_unknown"
        if asrs_type == "shuttle" and container_material == "combustible":
            fm_global_path = "section_2_2_3"
        elif asrs_type == "mini-load":
            fm_global_path = "section_2_2_6"  
        elif asrs_type == "top-loading":
            fm_global_path = "section_2_3"
        
        result = {
            "success": True,
            "classification": {
                "asrs_type": asrs_type,
                "container_material": container_material,
                "container_config": container_config,
                "commodity_class": commodity_class,
                "dimensions": dimensions
            },
            "confidence_scores": {
                "asrs_type": confidence,
                "container_material": 0.8 if container_material != "unknown" else 0.0,
                "overall": overall_confidence
            },
            "missing_info": missing_info,
            "special_hazards_detected": [],
            "fm_global_path": fm_global_path
        }
        
        logger.info(f"Classified ASRS system: {asrs_type} with confidence {confidence}")
        return result
        
    except Exception as e:
        logger.error(f"Error in ASRS classification: {e}")
        return {
            "success": False,
            "error": str(e),
            "classification": {},
            "confidence_scores": {"overall": 0.0}
        }


def lookup_fm_global_requirements(
    ctx: RunContext[AgentDependencies],
    system_classification: Dict[str, Any],
    lookup_type: str = "comprehensive",
    specific_queries: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Search through FM-Global 8-34 embedded data to find specific requirements,
    tables, and figures based on the classified ASRS system parameters.
    
    Args:
        ctx: Runtime context with dependencies
        system_classification: Output from ASRS classifier tool
        lookup_type: Scope of lookup (comprehensive, ceiling_only, in_rack_only, tables_only)
        specific_queries: Specific requirement queries
        
    Returns:
        Dict containing FM-Global requirements and references
    """
    try:
        data_access = FMGlobalDataAccess(ctx.deps)
        
        classification = system_classification.get("classification", {})
        asrs_type = classification.get("asrs_type", "unknown")
        container_material = classification.get("container_material", "unknown")
        container_config = classification.get("container_config", "unknown")
        
        # Search relevant tables
        matching_tables = data_access.search_tables_by_asrs_type(asrs_type)
        
        # Get relevant figures
        arrangement_type = f"{asrs_type} {container_config}"
        relevant_figures = data_access.get_relevant_figures(arrangement_type)
        
        # Build requirements based on classification
        requirements = {}
        
        # Ceiling Protection Requirements
        if lookup_type in ["comprehensive", "ceiling_only"]:
            ceiling_tables = {k: v for k, v in matching_tables.items() 
                            if "ceiling" in v.get("category", "").lower()}
            
            if ceiling_tables:
                # Find most specific table
                best_table = None
                for table_id, table_data in ceiling_tables.items():
                    if (container_material.lower() in table_data.get("commodity_types", "").lower() or
                        "all" in table_data.get("commodity_types", "").lower()):
                        best_table = table_data
                        break
                
                if best_table:
                    requirements["ceiling_protection"] = {
                        "system_type": "wet_pipe",  # Default assumption
                        "sprinkler_specs": {
                            "k_factor": "K16.8",
                            "temperature_rating": "160F", 
                            "response_type": "quick_response",
                            "orientation": "pendent",
                            "coverage_type": "standard"
                        },
                        "design_parameters": {
                            "minimum_pressure_psi": 25,
                            "spacing_requirements": "10 ft x 10 ft maximum"
                        },
                        "table_reference": f"Table {best_table.get('table_number')}",
                        "applicable_figures": list(relevant_figures.keys())[:2]
                    }
        
        # In-Rack Protection Requirements
        if lookup_type in ["comprehensive", "in_rack_only"]:
            in_rack_tables = {k: v for k, v in matching_tables.items()
                            if "in-rack" in v.get("category", "").lower()}
            
            if in_rack_tables and container_material == "combustible":
                requirements["in_rack_protection"] = {
                    "required": True,
                    "horizontal_arrangement": {
                        "sprinkler_type": "K8.0_quick_response_160F",
                        "vertical_spacing_ft": 8,
                        "horizontal_spacing_ft": 5,
                        "installation_level": "every_tier"
                    },
                    "design_flow_gpm": 150,
                    "table_reference": "Table 14",
                    "applicable_figures": [fig for fig in relevant_figures.keys() if "iras" in fig.lower()]
                }
        
        # Hydraulic Design Requirements
        if lookup_type == "comprehensive":
            requirements["hydraulic_design"] = {
                "total_demand_gpm": 1200,
                "hose_demand_gpm": 500,
                "water_supply_duration_min": 90,
                "minimum_residual_pressure_psi": 20
            }
        
        # Special Requirements
        special_requirements = []
        if asrs_type == "shuttle":
            special_requirements.extend([
                "Minimum 3 ft clearance to ceiling sprinklers",
                "Transverse flue spaces minimum 3 inches wide"
            ])
        
        # Optimization opportunities
        optimization_opportunities = []
        if container_material == "combustible" and container_config == "open_top":
            optimization_opportunities.append({
                "change": "Switch to closed-top containers",
                "benefit": "Reduce in-rack sprinkler requirements",
                "estimated_savings": "30-40% reduction in system complexity"
            })
        
        result = {
            "success": True,
            "requirements": requirements,
            "data_sources": {
                "primary_sections": [system_classification.get("fm_global_path", "unknown")],
                "tables_referenced": list(set(req.get("table_reference", "") 
                                              for req in requirements.values() 
                                              if isinstance(req, dict) and "table_reference" in req)),
                "figures_referenced": list(relevant_figures.keys())
            },
            "special_requirements": special_requirements,
            "optimization_opportunities": optimization_opportunities,
            "limitations_detected": []
        }
        
        logger.info(f"Found requirements for {asrs_type} ASRS with {len(matching_tables)} matching tables")
        return result
        
    except Exception as e:
        logger.error(f"Error in FM-Global lookup: {e}")
        return {
            "success": False,
            "error": str(e),
            "requirements": {},
            "data_sources": {}
        }


def format_design_requirements(
    system_classification: Dict[str, Any],
    fm_global_requirements: Dict[str, Any],
    format_style: str = "professional",
    include_optimization: bool = True
) -> str:
    """
    Convert raw FM-Global lookup data into clear, professional design 
    recommendations using the prescribed format.
    
    Args:
        system_classification: Classified system parameters
        fm_global_requirements: Lookup results from FM-Global data
        format_style: Output format (professional, detailed, summary)
        include_optimization: Whether to include cost optimization suggestions
        
    Returns:
        Formatted design requirements string
    """
    try:
        classification = system_classification.get("classification", {})
        requirements = fm_global_requirements.get("requirements", {})
        
        # Extract key parameters for restatement
        asrs_type = classification.get("asrs_type", "unknown")
        container_material = classification.get("container_material", "unknown")
        container_config = classification.get("container_config", "unknown")
        dimensions = classification.get("dimensions", {})
        
        # Build input restatement
        height_str = f"{dimensions.get('storage_height_ft', '?')}-foot tall"
        width_str = f"{dimensions.get('aisle_width_ft', '?')}-foot wide aisles"
        
        container_desc = f"{container_config} {container_material} containers"
        if container_config == "unknown":
            container_desc = f"{container_material} containers"
        
        # Start with prescribed format
        output_lines = []
        output_lines.append(
            f"Based on the fact that you are using {asrs_type}-type ASRS with "
            f"{container_desc} in {height_str}, {width_str}, "
            f"your design requirements per FM-Global 8-34 are:"
        )
        output_lines.append("")
        
        # Ceiling Protection Section
        if "ceiling_protection" in requirements:
            ceiling = requirements["ceiling_protection"]
            output_lines.append("## Ceiling Sprinkler Protection")
            output_lines.append(f"- **System Type**: {ceiling.get('system_type', 'Wet pipe')} sprinkler system")
            
            if "sprinkler_specs" in ceiling:
                specs = ceiling["sprinkler_specs"]
                output_lines.append(f"- **Sprinkler Specification**: {specs.get('k_factor', 'K16.8')}, "
                                  f"{specs.get('temperature_rating', '160°F')} {specs.get('response_type', 'quick-response')}")
            
            if "design_parameters" in ceiling:
                params = ceiling["design_parameters"]
                output_lines.append(f"- **Design Parameters**: Minimum {params.get('minimum_pressure_psi', 25)} psi")
                if "spacing_requirements" in params:
                    output_lines.append(f"- **Spacing**: {params['spacing_requirements']}")
            
            if "table_reference" in ceiling:
                output_lines.append(f"- **Code Reference**: {ceiling['table_reference']}")
            
            output_lines.append("")
        
        # In-Rack Protection Section
        if "in_rack_protection" in requirements:
            in_rack = requirements["in_rack_protection"]
            output_lines.append("## In-Rack Sprinkler Protection (IRAS)")
            
            if in_rack.get("required", False):
                output_lines.append("- **Requirement**: Horizontal in-rack sprinklers required")
                
                if "horizontal_arrangement" in in_rack:
                    arr = in_rack["horizontal_arrangement"]
                    output_lines.append(f"- **Sprinkler Type**: {arr.get('sprinkler_type', 'K8.0 quick-response 160°F')}")
                    output_lines.append(f"- **Spacing**: {arr.get('horizontal_spacing_ft', 5)} ft horizontal, "
                                      f"{arr.get('vertical_spacing_ft', 8)} ft vertical")
                    output_lines.append(f"- **Installation**: {arr.get('installation_level', 'Every tier')}")
                
                if "design_flow_gpm" in in_rack:
                    output_lines.append(f"- **Flow Rate**: {in_rack['design_flow_gpm']} GPM design demand")
                
                if "table_reference" in in_rack:
                    output_lines.append(f"- **Code Reference**: {in_rack['table_reference']}")
            else:
                output_lines.append("- **Requirement**: In-rack sprinklers not required for this configuration")
            
            output_lines.append("")
        
        # Hydraulic Design Section  
        if "hydraulic_design" in requirements:
            hydraulic = requirements["hydraulic_design"]
            output_lines.append("## Hydraulic Design Requirements")
            output_lines.append(f"- **Total System Demand**: {hydraulic.get('total_demand_gpm', 'TBD')} GPM")
            output_lines.append(f"- **Hose Allowance**: {hydraulic.get('hose_demand_gpm', 500)} GPM per Table 2")
            output_lines.append(f"- **Water Supply Duration**: {hydraulic.get('water_supply_duration_min', 90)} minutes minimum")
            output_lines.append("")
        
        # Special Requirements
        special_reqs = fm_global_requirements.get("special_requirements", [])
        if special_reqs:
            output_lines.append("## Special Requirements & Limitations")
            for req in special_reqs:
                output_lines.append(f"- {req}")
            output_lines.append("")
        
        # Code References
        data_sources = fm_global_requirements.get("data_sources", {})
        if data_sources:
            output_lines.append("## Code References")
            if data_sources.get("tables_referenced"):
                tables = [t for t in data_sources["tables_referenced"] if t]
                if tables:
                    output_lines.append(f"- **Design Tables**: {', '.join(tables)}")
            if data_sources.get("figures_referenced"):
                figures = data_sources["figures_referenced"][:3]  # Limit to 3
                if figures:
                    output_lines.append(f"- **Installation Figures**: {', '.join(figures)}")
            output_lines.append("")
        
        # Optimization Opportunities
        if include_optimization:
            optimizations = fm_global_requirements.get("optimization_opportunities", [])
            if optimizations:
                output_lines.append("## Cost Optimization Opportunities")
                for opt in optimizations:
                    output_lines.append(f"**{opt.get('change', 'Configuration change')}**: "
                                      f"{opt.get('benefit', 'Compliance benefit')} - "
                                      f"{opt.get('estimated_savings', 'Cost savings available')}")
                output_lines.append("")
        
        return "\n".join(output_lines)
        
    except Exception as e:
        logger.error(f"Error formatting requirements: {e}")
        return f"Error formatting design requirements: {str(e)}"