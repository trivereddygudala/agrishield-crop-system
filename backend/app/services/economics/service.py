import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class CropEconomicsService:
    """
    Computes agricultural financial valuation, yield loss projections,
    treatment spray expenses, and Protection ROI in Indian Rupees (₹)
    calibrated against Indian APMC Mandi commodity benchmarks.
    """

    CROP_BENCHMARKS = {
        "tomato": {
            "display_name": "Tomato",
            "yield_quintals_per_acre": 120,
            "market_price_per_quintal": 1850,  # ₹1,850/quintal
            "treatment_chemical_cost": 550,     # ₹550 for Mancozeb/Chlorothalonil
            "treatment_labor_cost": 300,        # ₹300 sprayer labor
        },
        "potato": {
            "display_name": "Potato",
            "yield_quintals_per_acre": 100,
            "market_price_per_quintal": 1450,
            "treatment_chemical_cost": 600,
            "treatment_labor_cost": 300,
        },
        "pepper": {
            "display_name": "Bell Pepper / Chilli",
            "yield_quintals_per_acre": 30,      # dry weight equivalent
            "market_price_per_quintal": 16500,  # High-value spice commodity
            "treatment_chemical_cost": 750,
            "treatment_labor_cost": 350,
        },
        "chilli": {
            "display_name": "Chilli",
            "yield_quintals_per_acre": 30,
            "market_price_per_quintal": 16500,
            "treatment_chemical_cost": 750,
            "treatment_labor_cost": 350,
        },
        "cotton": {
            "display_name": "Cotton",
            "yield_quintals_per_acre": 12,
            "market_price_per_quintal": 7200,
            "treatment_chemical_cost": 650,
            "treatment_labor_cost": 300,
        },
        "rice": {
            "display_name": "Paddy / Rice",
            "yield_quintals_per_acre": 28,
            "market_price_per_quintal": 2300,
            "treatment_chemical_cost": 450,
            "treatment_labor_cost": 250,
        },
        "corn": {
            "display_name": "Maize / Corn",
            "yield_quintals_per_acre": 35,
            "market_price_per_quintal": 2100,
            "treatment_chemical_cost": 450,
            "treatment_labor_cost": 250,
        },
        "onion": {
            "display_name": "Onion",
            "yield_quintals_per_acre": 110,
            "market_price_per_quintal": 1900,
            "treatment_chemical_cost": 500,
            "treatment_labor_cost": 300,
        }
    }

    SEVERITY_TIERS = {
        "early": {"label": "Early Incubation", "loss_pct": 10.0, "spread_rate_per_day": 1.5},
        "moderate": {"label": "Moderate Spread", "loss_pct": 32.0, "spread_rate_per_day": 2.8},
        "severe": {"label": "Severe Infection", "loss_pct": 60.0, "spread_rate_per_day": 4.5},
        "critical": {"label": "Critical Outbreak", "loss_pct": 82.0, "spread_rate_per_day": 5.0}
    }

    def calculate_economic_impact(
        self,
        crop_name: str = "Tomato",
        disease_name: str = "Early Blight",
        severity_stage: str = "moderate",
        farm_size_acres: float = 1.0,
        custom_market_price: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculates expected harvest loss, treatment cost, and net return on treatment.
        """
        crop_key = crop_name.lower().strip()
        benchmark = self.CROP_BENCHMARKS.get(crop_key)

        # Fallback to closest match or generic horticultural crop
        if not benchmark:
            for k, v in self.CROP_BENCHMARKS.items():
                if k in crop_key or crop_key in k:
                    benchmark = v
                    break
        if not benchmark:
            benchmark = {
                "display_name": crop_name,
                "yield_quintals_per_acre": 60,
                "market_price_per_quintal": 2000,
                "treatment_chemical_cost": 500,
                "treatment_labor_cost": 300,
            }

        acres = max(0.1, float(farm_size_acres))
        yield_per_acre = benchmark["yield_quintals_per_acre"]
        price_per_quintal = float(custom_market_price) if custom_market_price else benchmark["market_price_per_quintal"]

        # 1. Gross Potential Valuation
        total_potential_yield_quintals = round(yield_per_acre * acres, 2)
        gross_potential_value = round(total_potential_yield_quintals * price_per_quintal, 2)

        # 2. Disease Severity Loss
        stage_key = severity_stage.lower().strip()
        if "crit" in stage_key or "outbreak" in stage_key:
            stage_info = self.SEVERITY_TIERS["critical"]
        elif "sev" in stage_key or "high" in stage_key:
            stage_info = self.SEVERITY_TIERS["severe"]
        elif "mod" in stage_key or "medium" in stage_key:
            stage_info = self.SEVERITY_TIERS["moderate"]
        else:
            stage_info = self.SEVERITY_TIERS["early"]

        yield_loss_pct = stage_info["loss_pct"]
        untreated_loss_quintals = round(total_potential_yield_quintals * (yield_loss_pct / 100.0), 2)
        projected_financial_loss = round(untreated_loss_quintals * price_per_quintal, 2)

        # 3. Treatment Cost
        treatment_cost_per_acre = benchmark["treatment_chemical_cost"] + benchmark["treatment_labor_cost"]
        total_treatment_cost = round(treatment_cost_per_acre * acres, 2)

        # 4. Protection Savings & ROI
        # Prompt treatment arrests the disease, preserving ~88-92% of the threatened yield
        salvageable_ratio = 0.90
        net_harvest_value_saved = round(projected_financial_loss * salvageable_ratio, 2)
        protection_roi = round(net_harvest_value_saved / max(1.0, total_treatment_cost), 1)

        # 5. Delay Urgency Curve (48h & 7 days)
        delay_48h_loss_pct = min(95.0, yield_loss_pct + (stage_info["spread_rate_per_day"] * 2))
        delay_48h_loss_inr = round(total_potential_yield_quintals * (delay_48h_loss_pct / 100.0) * price_per_quintal, 2)
        additional_loss_if_delayed = round(delay_48h_loss_inr - projected_financial_loss, 2)

        return {
            "crop_name": benchmark["display_name"],
            "disease_name": disease_name,
            "severity_stage": stage_info["label"],
            "farm_size_acres": acres,
            "market_economics": {
                "benchmark_yield_quintals_per_acre": yield_per_acre,
                "mandi_price_per_quintal": price_per_quintal,
                "currency": "INR",
                "currency_symbol": "₹",
                "gross_potential_value": gross_potential_value,
                "total_potential_yield_quintals": total_potential_yield_quintals
            },
            "loss_assessment": {
                "yield_loss_percentage": yield_loss_pct,
                "projected_yield_loss_quintals": untreated_loss_quintals,
                "projected_financial_loss": projected_financial_loss,
                "risk_status": "Severe Threat" if yield_loss_pct >= 50 else ("Moderate Loss" if yield_loss_pct >= 25 else "Minor Spotting")
            },
            "treatment_roi": {
                "chemical_cost_per_acre": benchmark["treatment_chemical_cost"],
                "labor_cost_per_acre": benchmark["treatment_labor_cost"],
                "total_treatment_cost": total_treatment_cost,
                "net_harvest_value_saved": net_harvest_value_saved,
                "protection_roi_multiplier": protection_roi,  # e.g. 74.2x
                "roi_badge": f"{protection_roi}x Return on Spray"
            },
            "urgency_forecast": {
                "daily_spread_rate_pct": stage_info["spread_rate_per_day"],
                "delay_48h_projected_loss": delay_48h_loss_inr,
                "additional_loss_48h_delay": additional_loss_if_delayed,
                "urgency_action": f"Spraying today saves an extra ₹{additional_loss_if_delayed:,.0f} compared to waiting 48 hours."
            }
        }
