import json


class PromptManager:

    @staticmethod
    def customer_intake_normalization(raw_row: dict) -> str:
        return f"""You are a data extraction assistant for insurance customer onboarding.

Normalize the following CSV or form row into a clean customer intake JSON.

ROW:
{json.dumps(raw_row, indent=2)}

Return JSON with:
- name: string
- email: string
- phone: string
- date_of_birth: string|null
- annual_income: number|null
- dependents: number|null
- risk_appetite: LOW|MEDIUM|HIGH|null
- kyc_status: string|null
- financial_goals: list of strings
- notes: string|null

Respond ONLY with valid JSON."""

    @staticmethod
    def needs_analysis(customer_profile: dict) -> str:
        return f"""You are an expert insurance advisor.

Analyze this customer profile and generate a structured needs analysis:

CUSTOMER PROFILE:
{json.dumps(customer_profile, indent=2)}

Return a JSON with keys:
- risk_profile: LOW|MEDIUM|HIGH
- recommended_coverage_type: TERM|ENDOWMENT|ULIP|HEALTH
- suggested_sum_assured: integer
- suggested_tenure: integer (years)
- key_needs: list of strings
- justification: string

Respond ONLY with valid JSON."""

    @staticmethod
    def suitability_check(customer_profile: dict, product: dict) -> str:
        return f"""You are a compliance expert.

Check if this product is suitable for this customer:

CUSTOMER: {json.dumps(customer_profile, indent=2)}
PRODUCT:  {json.dumps(product, indent=2)}

Return JSON with:
- is_suitable: true|false
- compliance_flags: list
- eligibility_score: 0.0-1.0
- remarks: string

Respond ONLY with valid JSON."""

    @staticmethod
    def quote_comparison(quotes: list, needs: dict) -> str:
        return f"""You are an insurance comparison specialist.

Rank and compare these quotes based on the customer needs:

QUOTES:
{json.dumps(quotes, indent=2)}

CUSTOMER NEEDS:
{json.dumps(needs, indent=2)}

Return JSON with:
- ranked_quotes: [{{"insurer_code": "", "rank": 1, "score": 0.95, "reason": ""}}]
- top_recommendation: insurer_code
- recommendation_summary: string

Respond ONLY with valid JSON."""

    @staticmethod
    def rag_chat(query: str, chunks: list, graph_data: list, history: str = "") -> str:
        ctx = "\n\n".join([c.get("text", "") for c in chunks[:5]])
        graph_ctx = json.dumps(graph_data[:10], indent=2) if graph_data else "[]"
        return f"""You are an insurance knowledge assistant.

{f"CONVERSATION HISTORY:{chr(10)}{history}{chr(10)}" if history else ""}

RETRIEVED KNOWLEDGE:
{ctx}

RELATED GRAPH DATA:
{graph_ctx}

USER QUESTION:
{query}

Answer based strictly on the knowledge provided. Be concise and accurate.
If you cannot answer from the context, say so clearly."""

    @staticmethod
    def exception_analysis(case_data: dict) -> str:
        return f"""You are an insurance exception specialist.

Analyze this case for compliance exceptions or anomalies:

CASE DATA:
{json.dumps(case_data, indent=2)}

Return JSON with:
- exceptions: list of {{type, severity, description}}
- risk_level: LOW|MEDIUM|HIGH|CRITICAL
- recommended_action: string

Respond ONLY with valid JSON."""

    @staticmethod
    def proposal_generation(case_data: dict, quote: dict) -> str:
        return f"""You are an insurance proposal writer.

Generate a structured proposal for this case and selected quote:

CASE: {json.dumps(case_data, indent=2)}
QUOTE: {json.dumps(quote, indent=2)}

Return JSON with:
- proposal_summary: string
- key_benefits: list
- premium_breakdown: dict
- terms_highlights: list
- next_steps: list

Respond ONLY with valid JSON."""
