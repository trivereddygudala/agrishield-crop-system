# AgriShield Crop Disease Detection System — Comprehensive Crop & Disease Coverage Audit

**Document Version:** 1.0  
**Generated Date:** September 25, 2026  
**Audited Target Crops:** 29 Indian Agricultural, Horticultural, Pulse, Oilseed, Cash, and Vegetable Crops  
**AI Architecture Inspected:**
1. **Tier 1 (Local Neural Model):** Local PyTorch / ONNX Deep Learning Neural Network (`best_model.pth` / `best_model_quantized.onnx`, 1,252 classes) — Offline fast inference (< 50ms).
2. **Tier 2 (Multimodal AI Vision):** Google Gemini 2.0 / 1.5 Flash Vision Multimodal Agricultural Pathology Engine — Online universal diagnostics for all crops, pests, and nutrient deficiencies.
3. **Tier 3 (Agronomic Advisory Engine):** Expert ICAR / TNAU / ANGRAU verified treatment database (`DISEASE_KB` & `COMMON_DISEASES`) supporting 13 regional Indian languages.

---

## Executive Summary: System Coverage Breakdown

| Crop Classification | Number of Crops | System Support Level | Primary Diagnostic Engine |
| :--- | :---: | :--- | :--- |
| **Tier 1 Crops (Local Model + AI Vision)** | **7** | **Fully Supported (Offline + Online)** | Local PyTorch CNN/ViT (0–50ms) + Gemini Multimodal Vision + Advisory KB |
| **Tier 2 Crops (Multimodal AI Vision + Advisory)** | **22** | **Fully Supported (Online AI Vision)** | Gemini 2.0 / 1.5 Vision Pathology Engine + Advisory KB |
| **Total Crops Covered** | **29 / 29 (100%)** | **Fully Analyzable on Website** | Dual-Engine Hybrid Pipeline |

---

## Technical Diagnostic Capabilities & Inherent Imaging Limitations

### What AgriShield CAN Detect from Leaf & Plant Photos:
- **Foliar Fungal Pathogens:** Leaf spots (Cercospora, Alternaria, Septoria), blights (early blight, late blight, bacterial leaf blight), rusts, powdery mildew, downy mildew, anthracnose lesions.
- **Foliar Bacterial Infections:** Angular water-soaked lesions, black rot V-shaped chlorosis, bacterial spots, leaf blights.
- **Viral Diseases with Visible Foliar Manifestations:** Mosaic patterns, leaf curl, vein clearing, yellow vein mosaic, enations, puckering, and stunting.
- **Entomological & Pest Damage:** Chewing holes (Spodoptera litura, caterpillars, armyworms), leaf curling/silvering from sucking pests (thrips, aphids, whiteflies, mites), leaf miner serpentine mines.
- **Advanced Vascular Wilts (Foliar Stage):** Characteristic irreversible midday drooping, unilateral yellowing, and flaccidity.

### Inherent Agricultural Vision Limitations (What Cannot Be Detected from a Leaf Photo Alone):
- **Underground Subterranean Root Pathogens:** Root-knot nematode (*Meloidogyne*) galls, root rot, collar rot at the sub-soil level unless the root system is excavated and photographed.
- **Internal Stem Borers & Rhizome Rot:** Larvae feeding inside solid stalks (Sugarcane stem borer, Red Gram pod fly) or rhizome rotting (Turmeric soft rot) before external yellowing or dead-hearts appear on foliage.
- **Latent / Pre-symptomatic Systemic Infections:** Pathogens during incubation before visual foliar lesions, chlorosis, or necrosis emerge.
- **Seed-borne Pathogens:** Infections residing inside dormant seed coats before germination.
- **Nutritional Deficiencies Mimicking Viruses:** Severe micronutrient imbalances (e.g., zinc, iron, magnesium chlorosis) that perfectly resemble viral vein clearing without chemical laboratory soil/tissue testing.

---

## Detailed Crop-by-Crop Audit (All 29 Crops)

---

### 1. Rice (Paddy) (*Oryza sativa*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Rice_Bacterial_Leaf_Blight`, `Rice_Brown_Spot`, `Rice_Leaf_Smut`, `Rice_Stemfly`, `Rice_Gall_Midge`, `Rice_Leaf_Roller`, `Rice_Water_Weevil`, `Rice_Leafhopper`, `Asestic_Rice_Borer`, `Paddy_Stem_Maggot`.
* **Common Diseases Online (ICAR/TNAU):** Bacterial Leaf Blight, Blast (*Magnaporthe oryzae*), Brown Spot, Sheath Blight, False Smut, Tungro Virus, Stem Borer, Gall Midge, Leaf Folder, Brown Planthopper (BPH).
* **Diseases Detected by AgriShield:**
  - ✅ Bacterial Leaf Blight (*Xanthomonas oryzae*)
  - ✅ Brown Spot (*Bipolaris oryzae*)
  - ✅ Leaf Smut (*Entyloma oryzae*)
  - ✅ Rice Blast (*Magnaporthe oryzae* / *Pyricularia grisea*)
  - ✅ Sheath Blight (*Rhizoctonia solani*)
  - ✅ Rice Stem Borer damage ("Dead heart" / "White earhead")
  - ✅ Rice Leaf Roller / Folder damage
  - ✅ Brown Planthopper (BPH) & Green Leafhopper
* **Diseases / Conditions NOT Detected:**
  - ❌ Early internal stem borer tunneling before foliar dead-heart appears.
  - ❌ Udbatta disease during early vegetative phase.
  - ❌ Root-knot nematode (*Meloidogyne graminicola*) without root excavation.

---

### 2. Maize (Corn) (*Zea mays*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot`, `Corn_(maize)___Common_rust_`, `Corn_(maize)___Northern_Leaf_Blight`, `Corn_Borer`, `Corn_Earworm`, `Corn_Stemfly`, `Corn_Leaf_Aphid`, `Corn_Planthopper`.
* **Common Diseases Online (ICAR/TNAU):** Northern Corn Leaf Blight, Common Rust, Gray Leaf Spot (Cercospora), Fall Armyworm, Maize Downy Mildew, Banded Leaf and Sheath Blight, Stalk Rot (Fusarium/Charcoal rot), Smut.
* **Diseases Detected by AgriShield:**
  - ✅ Northern Corn Leaf Blight (*Exserohilum turcicum*)
  - ✅ Common Rust (*Puccinia sorghi*)
  - ✅ Gray Leaf Spot / Cercospora Leaf Spot (*Cercospora zeae-maydis*)
  - ✅ Fall Armyworm (*Spodoptera frugiperda*) foliar whorl damage
  - ✅ Corn Borer foliar damage & entry holes
  - ✅ Corn Aphid & Planthopper colonies
* **Diseases / Conditions NOT Detected:**
  - ❌ Charcoal stalk rot (*Macrophomina*) before plant lodging or stem splitting.
  - ❌ Internal ear rot inside intact husk before cob is opened.

---

### 3. Groundnut (Peanut) (*Arachis hypogaea*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Groundnut___ALTERNARIA LEAF SPOT`, `Groundnut___LEAF SPOT (EARLY AND LATE) [Tikka]`, `Groundnut___ROSETTE`, `Groundnut___RUST`, `Groundnut___HEALTHY`.
* **Common Diseases Online (ICAR/TNAU):** Early Leaf Spot (*Cercospora arachidicola*), Late Leaf Spot (*Phaeoisariopsis personata*), Rust (*Puccinia arachidis*), Alternaria Leaf Spot, Groundnut Rosette Virus, Stem Rot / Collar Rot (*Sclerotium rolfsii*), Aflatoxin contamination.
* **Diseases Detected by AgriShield:**
  - ✅ Tikka Disease (Early & Late Cercospora Leaf Spots)
  - ✅ Groundnut Rust (*Puccinia arachidis*)
  - ✅ Alternaria Leaf Spot
  - ✅ Groundnut Rosette Virus (chlorotic & green rosette stunting)
  - ✅ Spodoptera litura foliar defoliation
* **Diseases / Conditions NOT Detected:**
  - ❌ Aflatoxin (*Aspergillus flavus*) contamination inside intact underground pods.
  - ❌ Collar rot at root-stem junction before foliage completely wilts.

---

### 4. Tomato (*Solanum lycopersicum*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Tomato_Early_blight`, `Tomato_Late_blight`, `Tomato_Bacterial_spot`, `Tomato_Septoria_leaf_spot`, `Tomato_Leaf_Mold`, `Tomato__Target_Spot`, `Tomato__Tomato_YellowLeaf__Curl_Virus`, `Tomato__Tomato_mosaic_virus`, `Tomato_Spider_mites_Two_spotted_spider_mite`.
* **Common Diseases Online (ICAR/TNAU):** Early Blight, Late Blight, Bacterial Spot, Septoria Leaf Spot, Leaf Mold, Target Spot, Tomato Yellow Leaf Curl Virus (TYLCV), Mosaic Virus (ToMV), Two-Spotted Spider Mite, Bacterial Wilt, Root-knot Nematode.
* **Diseases Detected by AgriShield:**
  - ✅ Early Blight (*Alternaria solani*)
  - ✅ Late Blight (*Phytophthora infestans*)
  - ✅ Bacterial Spot (*Xanthomonas perforans*)
  - ✅ Septoria Leaf Spot (*Septoria lycopersici*)
  - ✅ Leaf Mold (*Passalora fulva*)
  - ✅ Target Spot (*Corynespora cassiicola*)
  - ✅ Tomato Yellow Leaf Curl Virus (TYLCV)
  - ✅ Tomato Mosaic Virus (ToMV)
  - ✅ Two-spotted Spider Mite (*Tetranychus urticae*) stippling
* **Diseases / Conditions NOT Detected:**
  - ❌ Internal vascular bacterial wilt (*Ralstonia solanacearum*) before irreversible midday wilting.
  - ❌ Root-knot nematode root galls without uprooting.

---

### 5. Cotton (*Gossypium hirsutum*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Cotton___Bacterial_blight`, `Cotton___Curl_virus`, `Cotton___Fusarium_wilt`, `Cotton_Aphid`, `Cotton_Bollworm`, `Cotton_Cutworm`, `Cotton_Leafworm`, `Cotton_Whitefly`.
* **Common Diseases Online (ICAR/TNAU):** Bacterial Blight (Angular Leaf Spot / Blackarm), Cotton Leaf Curl Virus (CLCuD), Fusarium Wilt, Alternaria Leaf Spot, Grey Mildew, Bollworm complex, Aphids, Whiteflies.
* **Diseases Detected by AgriShield:**
  - ✅ Bacterial Blight / Angular Leaf Spot (*Xanthomonas citri pv. malvacearum*)
  - ✅ Cotton Leaf Curl Virus (CLCuD)
  - ✅ Fusarium Wilt foliar chlorosis & veinal discoloration
  - ✅ Cotton Aphids & Whitefly sooty mold
  - ✅ Cotton Leafworm / Bollworm foliage & bract chewing
* **Diseases / Conditions NOT Detected:**
  - ❌ Pink bollworm larvae hidden deep inside sealed immature green bolls without external boreholes.
  - ❌ Root rot (*Rhizoctonia solani*) without inspecting taproot bark.

---

### 6. Red Gram (Tur / Pigeon Pea) (*Cajanus cajan*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Local Neural Classes:** Non-specific; handled via Gemini Vision & Advisory KB.
* **Common Diseases Online (ICAR/TNAU):** Fusarium Wilt (*Fusarium udum*), Sterility Mosaic Disease (SMD), Phytophthora Blight, Dry Root Rot (*Macrophomina*), Alternaria Leaf Blight, Pod Borer (*Helicoverpa*), Pod Fly (*Melanagromyza*).
* **Diseases Detected by AgriShield:**
  - ✅ Sterility Mosaic Disease (SMD - bushy stunted growth & mosaic chlorosis)
  - ✅ Phytophthora Stem & Leaf Blight
  - ✅ Alternaria Leaf Blight
  - ✅ Pod Borer external pod damage and leaf chewing
  - ✅ Spodoptera caterpillar defoliation
* **Diseases / Conditions NOT Detected:**
  - ❌ Internal Pod Fly (*Melanagromyza obtusa*) larvae feeding inside closed pods.
  - ❌ Sub-soil Fusarium vascular root rot before aerial canopy wilts.

---

### 7. Sugarcane (*Saccharum officinarum*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Sugarcane___RedRot`, `Sugarcane___Mosaic`, `Sugarcane___Rust`, `Sugarcane___Yellow`.
* **Common Diseases Online (ICAR/TNAU):** Red Rot (*Colletotrichum falcatum*), Sugarcane Mosaic Virus, Rust (*Puccinia melanocephala*), Yellow Leaf Disease (SCYLV), Whip Smut (*Sporisorium scitamineum*), Grassy Shoot Disease.
* **Diseases Detected by AgriShield:**
  - ✅ Red Rot leaf midrib lesions & canopy drying (*Colletotrichum falcatum*)
  - ✅ Sugarcane Mosaic Virus
  - ✅ Sugarcane Rust
  - ✅ Yellow Leaf Disease (SCYLV)
  - ✅ Whip Smut (black whip-like floral structure)
* **Diseases / Conditions NOT Detected:**
  - ❌ Internal stalk red rot pith discoloration before leaf midrib lesions appear.
  - ❌ Sett rot in buried sugarcane seed setts prior to germination.

---

### 8. Chillies (Green & Dry Red Chilli) (*Capsicum annuum*)
* **System Support Tier:** **Tier 1 (Fully Supported Locally & Online)**
* **Local Neural Classes Trained:** `Chilli___Anthracnose`, `Chilli___Leaf_Curl_Virus`, `Chilli___Leaf_Spot`, `Chilli___Damping_Off`, `Chilli___Veinal_Mottle_Virus`, `Chilli___Whitefly`, `Chilli___Yellowish`.
* **Common Diseases Online (ICAR/TNAU):** Anthracnose / Fruit Rot / Dieback (*Colletotrichum capsici*), Chilli Leaf Curl Virus, Chilli Thrips (*Scirtothrips dorsalis*), Damping Off, Bacterial Leaf Spot, Powdery Mildew, Cercospora Leaf Spot.
* **Diseases Detected by AgriShield:**
  - ✅ Anthracnose, Dieback & Fruit Rot (*Colletotrichum capsici*)
  - ✅ Chilli Thrips upward leaf curling & crinkling (Plantix Narrative Engine)
  - ✅ Chilli Leaf Curl Virus (geminivirus / whitefly vector)
  - ✅ Cercospora Leaf Spot
  - ✅ Bacterial Spot (*Xanthomonas*)
  - ✅ Damping Off in nursery beds
  - ✅ Powdery Mildew (*Leveillula taurica*)
* **Diseases / Conditions NOT Detected:**
  - ❌ Root-knot nematode root galls without excavated roots.
  - ❌ Early Phytophthora root rot before irreversible midday wilting.

---

### 9. Turmeric (*Curcuma longa*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Leaf Spot (*Colletotrichum capsici*), Leaf Blotch (*Taphrina maculans*), Rhizome Rot / Soft Rot (*Pythium aphanidermatum*), Dry Rot.
* **Diseases Detected by AgriShield:**
  - ✅ Turmeric Leaf Spot (elliptical brown lesions with yellow halos)
  - ✅ Leaf Blotch (reddish-brown dirty spots coalescing on leaf blades)
  - ✅ Advanced Rhizome Rot aerial foliar yellowing & pseudostem drying
* **Diseases / Conditions NOT Detected:**
  - ❌ Early sub-surface rhizome soft rot before foliar symptoms emerge.
  - ❌ Scale insect infestation on stored seed rhizomes.

---

### 10. Brinjal (Eggplant) (*Solanum melongena*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Little Leaf of Brinjal (phytoplasma), Phomopsis Blight & Fruit Rot, Bacterial Wilt, Cercospora Leaf Spot, Alternaria Leaf Spot, Shoot and Fruit Borer (*Leucinodes orbonalis*).
* **Diseases Detected by AgriShield:**
  - ✅ Little Leaf of Brinjal (miniaturized bushy leaf clusters)
  - ✅ Phomopsis Blight & Fruit Rot (sunken concentric dark lesions)
  - ✅ Cercospora and Alternaria Leaf Spots
  - ✅ Shoot & Fruit Borer damage (wilted shoot tips & borehole droppings)
  - ✅ Chewing caterpillar leaf perforations
* **Diseases / Conditions NOT Detected:**
  - ❌ Vascular ring browning of bacterial wilt before foliar drooping occurs.

---

### 11. Okra (Lady's Finger) (*Abelmoschus esculentus*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Yellow Vein Mosaic Virus (YVMV), Enation Leaf Curl Virus (ELCV), Powdery Mildew (*Erysiphe*), Cercospora Leaf Spot, Fusarium Wilt, Shoot and Fruit Borer (*Earias*).
* **Diseases Detected by AgriShield:**
  - ✅ Yellow Vein Mosaic Virus (YVMV - distinct yellow net veins)
  - ✅ Enation Leaf Curl Virus (thickened veins and leaf curling)
  - ✅ Powdery Mildew (white floury patches on leaves)
  - ✅ Cercospora Leaf Spot
  - ✅ Fruit borer holes and caterpillar chewing damage
* **Diseases / Conditions NOT Detected:**
  - ❌ Sub-soil Fusarium collar rot before plant collapse.

---

### 12. Bitter Gourd (*Momordica charantia*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Downy Mildew (*Pseudoperonospora*), Powdery Mildew, Mosaic Virus (CMV), Anthracnose, Fruit Fly (*Bactrocera cucurbitae*), Fusarium Wilt.
* **Diseases Detected by AgriShield:**
  - ✅ Downy Mildew (angular chlorotic spots bounded by leaf veins)
  - ✅ Powdery Mildew (ashy white powder on leaf blades)
  - ✅ Cucumber Mosaic Virus (leaf mottling & blistering)
  - ✅ Anthracnose lesions on leaves and fruits
  - ✅ Fruit Fly surface sting punctures & weeping resin drops
* **Diseases / Conditions NOT Detected:**
  - ❌ Maggots feeding inside intact fruits without visible external sting punctures.

---

### 13. Bottle Gourd (*Lagenaria siceraria*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Downy Mildew, Powdery Mildew, Anthracnose, Mosaic Virus, Choanephora Wet Rot, Blossom End Rot.
* **Diseases Detected by AgriShield:**
  - ✅ Downy Mildew
  - ✅ Powdery Mildew
  - ✅ Anthracnose circular fruit and leaf spots
  - ✅ Mosaic Virus leaf distortion
  - ✅ Choanephora Wet Rot on blossoms and tender fruits
* **Diseases / Conditions NOT Detected:**
  - ❌ Subterranean root-knot nematodes without root excavation.

---

### 14. Ridge Gourd (*Luffa acutangula*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Downy Mildew, Powdery Mildew, Anthracnose, Mosaic Virus, Fruit Rot, Gummy Stem Blight.
* **Diseases Detected by AgriShield:**
  - ✅ Downy Mildew
  - ✅ Powdery Mildew
  - ✅ Mosaic Virus puckering
  - ✅ Anthracnose lesions
* **Diseases / Conditions NOT Detected:**
  - ❌ Gummy stem blight crown cankers hidden under mulch or soil.

---

### 15. Cluster Beans (Guar) (*Cyamopsis tetragonoloba*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Bacterial Blight (*Xanthomonas cyamopsidis*), Alternaria Leaf Spot, Powdery Mildew, Anthracnose, Root Rot.
* **Diseases Detected by AgriShield:**
  - ✅ Bacterial Blight (interveinal necrotic spots and leaf vein blackening)
  - ✅ Alternaria Leaf Spot (concentric target-like spots)
  - ✅ Powdery Mildew
* **Diseases / Conditions NOT Detected:**
  - ❌ Sclerotium collar rot before complete foliar collapse.

---

### 16. Black Gram (Urad) (*Vigna mungo*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Mungbean Yellow Mosaic Virus (MYMV), Powdery Mildew (*Erysiphe polygoni*), Cercospora Leaf Spot, Anthracnose, Dry Root Rot (*Macrophomina*).
* **Diseases Detected by AgriShield:**
  - ✅ Yellow Mosaic Virus (bright golden-yellow patches on leaves)
  - ✅ Powdery Mildew (white floury dusting on leaves and pods)
  - ✅ Cercospora Leaf Spot
  - ✅ Anthracnose (sunken dark spots on pods and foliage)
  - ✅ Spodoptera litura leaf damage
* **Diseases / Conditions NOT Detected:**
  - ❌ Sub-soil dry root rot before stem bark shredding and foliage drying.

---

### 17. Green Gram (Moong) (*Vigna radiata*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Mungbean Yellow Mosaic Virus (MYMV), Powdery Mildew, Cercospora Leaf Spot, Anthracnose, Web Blight (*Rhizoctonia*).
* **Diseases Detected by AgriShield:**
  - ✅ Yellow Mosaic Virus (MYMV)
  - ✅ Powdery Mildew
  - ✅ Cercospora Leaf Spot
  - ✅ Anthracnose
  - ✅ Web Blight (irregular water-soaked lesions with mycelial webbing)
* **Diseases / Conditions NOT Detected:**
  - ❌ Seed-borne viral transmission in unsprouted seeds.

---

### 18. Bengal Gram (Chickpea) (*Cicer arietinum*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Ascochyta Blight (*Ascochyta rabiei*), Fusarium Wilt (*Fusarium oxysporum f.sp. ciceri*), Collar Rot (*Sclerotium rolfsii*), Dry Root Rot, Botrytis Grey Mold, Pod Borer (*Helicoverpa*).
* **Diseases Detected by AgriShield:**
  - ✅ Ascochyta Blight (circular brown lesions with concentric dark dots on leaflets and pods)
  - ✅ Botrytis Grey Mold (fuzzy grey mold on flowers and leaflets)
  - ✅ Pod Borer damage and leaf defoliation
  - ✅ Fusarium Wilt foliar yellowing and drooping
* **Diseases / Conditions NOT Detected:**
  - ❌ Early collar rot mycelium before stem girdling at ground level.

---

### 19. Sunflower (*Helianthus annuus*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Local Neural Classes:** Species recognized (`Helianthus_annuus`); pathology handled via Gemini Vision.
* **Common Diseases Online (ICAR/TNAU):** Alternaria Leaf Blight (*Alternaria helianthi*), Rust (*Puccinia helianthi*), Downy Mildew, Head Rot (*Rhizopus*), Charcoal Rot, Sunflower Necrosis Virus.
* **Diseases Detected by AgriShield:**
  - ✅ Alternaria Leaf Blight (dark brown necrotic spots with yellow halos)
  - ✅ Sunflower Rust (brown/black powdery pustules on leaves)
  - ✅ Rhizopus Head Rot on mature flower heads
  - ✅ Sunflower Necrosis Virus leaf distortion
* **Diseases / Conditions NOT Detected:**
  - ❌ Charcoal rot inside root vascular cylinder before stalk shredding.

---

### 20. Sesame (Til) (*Sesamum indicum*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Sesamum Phyllody (phytoplasma / leafhopper), Alternaria Leaf Blight, Cercospora Leaf Spot, Stem and Root Rot (*Macrophomina*), Powdery Mildew, Bacterial Blight.
* **Diseases Detected by AgriShield:**
  - ✅ Sesamum Phyllody (transformation of floral organs into abnormal leafy structures)
  - ✅ Alternaria Leaf Blight
  - ✅ Cercospora Leaf Spot
  - ✅ Powdery Mildew
* **Diseases / Conditions NOT Detected:**
  - ❌ Subterranean stem and root rot before lower leaves shed.

---

### 21. Tobacco (*Nicotiana tabacum*)
* **System Support Tier:** **Tier 2 (Supported via Local Model Pest Weights & Gemini Vision)**
* **Local Neural Classes Trained:** `Spodoptera litura` (Tobacco Caterpillar / Cutworm) local weights.
* **Common Diseases Online (ICAR/TNAU):** Tobacco Mosaic Virus (TMV), Tobacco Leaf Curl Virus, Black Shank (*Phytophthora*), Frog Eye Leaf Spot (*Cercospora nicotianae*), Brown Spot (*Alternaria*), Spodoptera litura.
* **Diseases Detected by AgriShield:**
  - ✅ Spodoptera litura (Tobacco Caterpillar leaf skeletonization) — Local Model
  - ✅ Tobacco Mosaic Virus (TMV - dark green blisters and mosaic mottle)
  - ✅ Tobacco Leaf Curl Virus (downward curled thickened leaves)
  - ✅ Frog Eye Leaf Spot (parchment-white centered spots)
  - ✅ Brown Spot (*Alternaria longipes*)
* **Diseases / Conditions NOT Detected:**
  - ❌ Black shank internal stem pith disc separation before whole-plant wilting.

---

### 22. Onion (*Allium cepa*)
* **System Support Tier:** **Tier 2 (Supported via Local Healthy Weight & Gemini Vision)**
* **Local Neural Classes Trained:** `Onion___healthy`.
* **Common Diseases Online (ICAR/TNAU):** Purple Blotch (*Alternaria porri*), Stemphylium Blight, Downy Mildew (*Peronospora destructor*), Basal Rot (*Fusarium*), Colletotrichum Blight (Twister Disease), Onion Thrips (*Thrips tabaci*), Black Mold (*Aspergillus niger*).
* **Diseases Detected by AgriShield:**
  - ✅ Purple Blotch (sunken purplish-brown elliptical lesions on tubular leaves)
  - ✅ Downy Mildew (pale chlorotic lesions with violet downy felt)
  - ✅ Twister Disease / Colletotrichum Blight (twisting of leaves & pseudo-stem)
  - ✅ Onion Thrips silvery feed patches
  - ✅ Black Mold on bulb scales
* **Diseases / Conditions NOT Detected:**
  - ❌ Internal neck rot deep inside bulb layers before slicing open.
  - ❌ Basal root rot underground before leaves yellow.

---

### 23. Cabbage (*Brassica oleracea var. capitata*)
* **System Support Tier:** **Tier 2 (Supported via Local Healthy Weight & Gemini Vision)**
* **Local Neural Classes Trained:** `Cabbage___healthy`.
* **Common Diseases Online (ICAR/TNAU):** Black Rot (*Xanthomonas campestris*), Clubroot (*Plasmodiophora brassicae*), Downy Mildew, Alternaria Leaf Spot, Diamondback Moth (DBM), Damping Off.
* **Diseases Detected by AgriShield:**
  - ✅ Black Rot ("V"-shaped yellow-brown marginal chlorosis with blackened veins)
  - ✅ Alternaria Leaf Spot / Black Spot (target-ring lesions)
  - ✅ Downy Mildew (yellow upper patches with downy white undersides)
  - ✅ Diamondback Moth (DBM) leaf windowing and shot-holes
* **Diseases / Conditions NOT Detected:**
  - ❌ Clubroot root swellings without digging up the plant.
  - ❌ Internal head rot inside tightly packed inner leaves.

---

### 24. Cauliflower (*Brassica oleracea var. botrytis*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Black Rot (*Xanthomonas campestris*), Downy Mildew, Alternaria Leaf Spot, Clubroot, Curd Rot, Whiptail (Molybdenum deficiency).
* **Diseases Detected by AgriShield:**
  - ✅ Black Rot (marginal "V"-shaped necrotic lesions and black veins)
  - ✅ Alternaria Leaf Spot
  - ✅ Downy Mildew
  - ✅ Curd Rot / Alternaria browning on white curd florets
  - ✅ Whiptail leaf narrowing & distortion
* **Diseases / Conditions NOT Detected:**
  - ❌ Sub-surface clubroot galls on roots.

---

### 25. Carrot (*Daucus carota*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Local Neural Classes Trained:** `Daucus_carota` (species recognition).
* **Common Diseases Online (ICAR/TNAU):** Alternaria Leaf Blight (*Alternaria dauci*), Cercospora Leaf Spot, Powdery Mildew, Bacterial Soft Rot, Sclerotinia Cottony Rot, Cavity Spot.
* **Diseases Detected by AgriShield:**
  - ✅ Alternaria Leaf Blight (brown necrotic margins on feathery foliage)
  - ✅ Cercospora Leaf Spot
  - ✅ Powdery Mildew
  - ✅ Bacterial Soft Rot on exposed root crown
* **Diseases / Conditions NOT Detected:**
  - ❌ Subterranean cavity spot or root forking while buried under soil.

---

### 26. Radish (*Raphanus sativus*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** White Rust (*Albugo candida*), Alternaria Blight (*Alternaria raphani*), Downy Mildew, Black Rot.
* **Diseases Detected by AgriShield:**
  - ✅ White Rust (chalky white blister pustules on leaf undersides)
  - ✅ Alternaria Blight (circular zoned dark brown leaf spots)
  - ✅ Downy Mildew
* **Diseases / Conditions NOT Detected:**
  - ❌ Internal root cylinder browning / black rot (*Aphanomyces*) before root slicing.

---

### 27. Coriander (*Coriandrum sativum*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Stem Gall (*Protomyces macrosporus*), Powdery Mildew (*Erysiphe polygoni*), Fusarium Wilt, Bacterial Leaf Spot.
* **Diseases Detected by AgriShield:**
  - ✅ Stem Gall (tumor-like blister swellings on stems, leaf veins, and seeds)
  - ✅ Powdery Mildew (white floury coating on delicate foliage)
  - ✅ Fusarium Wilt foliar yellowing and drooping
* **Diseases / Conditions NOT Detected:**
  - ❌ Latent seed-borne infection inside dry coriander seeds.

---

### 28. Spinach (Palak) (*Spinacia oleracea*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Downy Mildew (*Peronospora effusa*), Anthracnose (*Colletotrichum dematium*), Cercospora Leaf Spot, White Rust (*Albugo occidentalis*), Damping Off, Bacterial Soft Rot.
* **Diseases Detected by AgriShield:**
  - ✅ Downy Mildew (bright yellow chlorotic patches with violet/grey felt underneath)
  - ✅ Anthracnose (circular papery lesions with black acervuli specks)
  - ✅ Cercospora Leaf Spot (small spots with dark reddish-brown margins)
  - ✅ White Rust blister pustules
* **Diseases / Conditions NOT Detected:**
  - ❌ Pre-emergence damping off before seed emerges from soil.

---

### 29. Fenugreek (Methi) (*Trigonella foenum-graecum*)
* **System Support Tier:** **Tier 2 (Supported via Multimodal AI Vision & Advisory KB)**
* **Common Diseases Online (ICAR/TNAU):** Powdery Mildew (*Erysiphe polygoni / Leveillula taurica*), Cercospora Leaf Spot, Downy Mildew, Rust (*Uromyces trigonellae*), Rhizoctonia Root Rot.
* **Diseases Detected by AgriShield:**
  - ✅ Powdery Mildew (white talcum powder coating on trifoliate leaflets)
  - ✅ Cercospora Leaf Spot (necrotic circular foliar spots)
  - ✅ Downy Mildew
  - ✅ Rust (brown pustules on stems and leaf undersides)
* **Diseases / Conditions NOT Detected:**
  - ❌ Soil-borne Rhizoctonia root decay before aerial seedling collapse.

---

## Master Comparison Matrix: All 29 Crops

| # | Crop Name | Local PyTorch Model | Multimodal AI Vision (Gemini) | Common Diseases (Online ICAR/TNAU) | Specific Diseases Detected by Website | Diseases / Stages NOT Detected |
| :-: | :--- | :-: | :-: | :--- | :--- | :--- |
| **1** | **Rice (Paddy)** | ✅ Yes (10 classes) | ✅ Yes | Bacterial blight, Blast, Brown spot, Sheath blight, Smut, BPH | Bacterial blight, Brown spot, Leaf smut, Blast, Sheath blight, Stem borer, Leaf roller, BPH | Internal stem borer before dead heart; Root-knot nematodes |
| **2** | **Maize** | ✅ Yes (8 classes) | ✅ Yes | Northern leaf blight, Common rust, Gray leaf spot, Fall armyworm | Northern leaf blight, Common rust, Gray leaf spot, Fall armyworm, Corn borer | Charcoal stalk rot before lodging; Ear rot inside closed husk |
| **3** | **Groundnut** | ✅ Yes (5 classes) | ✅ Yes | Tikka leaf spot, Rust, Alternaria spot, Rosette virus, Collar rot | Tikka (Early & Late leaf spot), Rust, Alternaria, Rosette virus, Spodoptera | Underground pod rot & aflatoxin; Sub-soil collar rot |
| **4** | **Tomato** | ✅ Yes (9 classes) | ✅ Yes | Early blight, Late blight, Bacterial spot, Leaf mold, Target spot, TYLCV | Early blight, Late blight, Bacterial spot, Septoria, Leaf mold, Target spot, TYLCV, ToMV, Mites | Vascular bacterial wilt before midday wilt; Root-knot nematodes |
| **5** | **Cotton** | ✅ Yes (8 classes) | ✅ Yes | Bacterial blight, Leaf curl, Fusarium wilt, Bollworm, Whitefly | Bacterial blight, Leaf curl virus, Fusarium wilt, Aphids, Bollworm, Whitefly | Pink bollworm inside sealed bolls; Root rot without taproot inspection |
| **6** | **Red Gram (Tur)** | ⚠️ Via Advisory | ✅ Yes | Fusarium wilt, Sterility mosaic, Phytophthora blight, Dry root rot | Sterility mosaic disease, Phytophthora blight, Alternaria blight, Pod borer damage | Internal pod fly inside closed pods; Subterranean vascular wilt |
| **7** | **Sugarcane** | ✅ Yes (4 classes) | ✅ Yes | Red rot, Mosaic virus, Rust, Yellow leaf, Whip smut | Red rot midrib lesions, Mosaic virus, Rust, Yellow leaf disease, Whip smut | Internal stalk red rot before leaf midrib lesions; Seed sett rot |
| **8** | **Chillies** | ✅ Yes (7 classes) | ✅ Yes | Anthracnose, Leaf curl, Thrips, Damping off, Bacterial spot, Powdery mildew | Anthracnose / Dieback, Thrips upward curl, Leaf curl virus, Leaf spot, Damping off, Powdery mildew | Root-knot nematodes; Root rot before foliar wilting |
| **9** | **Turmeric** | ⚠️ Via Advisory | ✅ Yes | Leaf spot, Leaf blotch, Rhizome rot / Soft rot | Leaf spot, Leaf blotch, Advanced rhizome rot foliar yellowing | Early sub-surface rhizome soft rot; Stored rhizome scales |
| **10** | **Brinjal (Eggplant)** | ⚠️ Via Advisory | ✅ Yes | Little leaf, Phomopsis blight, Bacterial wilt, Shoot & fruit borer | Little leaf of brinjal, Phomopsis fruit rot, Cercospora spot, Shoot & fruit borer | Internal vascular ring browning before whole-plant wilting |
| **11** | **Okra (Lady's Finger)** | ⚠️ Via Advisory | ✅ Yes | Yellow vein mosaic (YVMV), Enation leaf curl, Powdery mildew | YVMV yellow vein net, Enation leaf curl, Powdery mildew, Borer holes | Soil-borne Fusarium collar rot before plant collapse |
| **12** | **Bitter Gourd** | ⚠️ Via Advisory | ✅ Yes | Downy mildew, Powdery mildew, Mosaic virus, Fruit fly, Anthracnose | Downy mildew, Powdery mildew, Cucumber mosaic virus, Anthracnose, Fruit fly | Maggots feeding inside intact fruits without external punctures |
| **13** | **Bottle Gourd** | ⚠️ Via Advisory | ✅ Yes | Downy mildew, Powdery mildew, Anthracnose, Mosaic, Wet rot | Downy mildew, Powdery mildew, Anthracnose, Mosaic virus, Choanephora wet rot | Subterranean root-knot nematodes |
| **14** | **Ridge Gourd** | ⚠️ Via Advisory | ✅ Yes | Downy mildew, Powdery mildew, Anthracnose, Mosaic virus | Downy mildew, Powdery mildew, Anthracnose, Mosaic leaf puckering | Gummy stem blight cankers below soil line |
| **15** | **Cluster Beans (Guar)** | ⚠️ Via Advisory | ✅ Yes | Bacterial blight, Alternaria spot, Powdery mildew, Root rot | Bacterial blight, Alternaria leaf spot, Powdery mildew | Sub-soil Sclerotium collar rot before foliar wilting |
| **16** | **Black Gram (Urad)** | ⚠️ Via Advisory | ✅ Yes | Yellow mosaic (MYMV), Powdery mildew, Cercospora spot, Anthracnose | Yellow mosaic virus, Powdery mildew, Cercospora spot, Anthracnose, Spodoptera | Soil-borne dry root rot before bark shredding |
| **17** | **Green Gram (Moong)** | ⚠️ Via Advisory | ✅ Yes | Yellow mosaic (MYMV), Powdery mildew, Cercospora spot, Web blight | Yellow mosaic virus, Powdery mildew, Cercospora spot, Web blight, Anthracnose | Seed-borne viral transmission in unsprouted seeds |
| **18** | **Bengal Gram (Chickpea)** | ⚠️ Via Advisory | ✅ Yes | Ascochyta blight, Fusarium wilt, Collar rot, Botrytis grey mold, Pod borer | Ascochyta blight, Botrytis grey mold, Pod borer damage, Fusarium foliar wilt | Early collar rot mycelium before stem girdling |
| **19** | **Sunflower** | ⚠️ Species Only | ✅ Yes | Alternaria blight, Rust, Head rot, Downy mildew, Necrosis virus | Alternaria leaf blight, Sunflower rust, Rhizopus head rot, Necrosis virus | Charcoal rot inside vascular cylinder before stem shredding |
| **20** | **Sesame (Til)** | ⚠️ Via Advisory | ✅ Yes | Phyllody, Alternaria blight, Cercospora spot, Stem and root rot | Sesamum phyllody (leafy flowers), Alternaria blight, Cercospora spot, Powdery mildew | Subterranean root rot before leaves drop |
| **21** | **Tobacco** | ⚠️ Pest Only | ✅ Yes | Tobacco mosaic (TMV), Leaf curl, Black shank, Frog eye spot, Spodoptera | Spodoptera litura (Local), TMV mosaic, Leaf curl, Frog eye spot, Brown spot | Black shank internal pith separation before aerial wilting |
| **22** | **Onion** | ⚠️ Healthy Only | ✅ Yes | Purple blotch, Downy mildew, Twister disease, Thrips, Basal rot | Purple blotch, Downy mildew, Twister disease, Onion thrips, Scale black mold | Internal bulb neck rot; Sub-soil basal rot |
| **23** | **Cabbage** | ⚠️ Healthy Only | ✅ Yes | Black rot, Clubroot, Downy mildew, Alternaria black spot, DBM | Black rot (V-shaped lesions), Alternaria black spot, Downy mildew, DBM holes | Clubroot root swellings; Internal head rot |
| **24** | **Cauliflower** | ⚠️ Via Advisory | ✅ Yes | Black rot, Downy mildew, Alternaria spot, Clubroot, Curd rot, Whiptail | Black rot, Alternaria leaf spot, Downy mildew, Curd rot browning, Whiptail | Sub-surface clubroot root galls |
| **25** | **Carrot** | ⚠️ Species Only | ✅ Yes | Alternaria leaf blight, Cercospora spot, Powdery mildew, Soft rot | Alternaria leaf blight, Cercospora spot, Powdery mildew, Crown soft rot | Subterranean cavity spot or root forking while buried |
| **26** | **Radish** | ⚠️ Via Advisory | ✅ Yes | White rust, Alternaria blight, Downy mildew, Black rot | White rust (white blisters), Alternaria blight, Downy mildew | Internal root cylinder black rot before slicing |
| **27** | **Coriander** | ⚠️ Via Advisory | ✅ Yes | Stem gall, Powdery mildew, Fusarium wilt, Bacterial spot | Stem gall (tumor-like blisters), Powdery mildew, Fusarium foliar wilt | Latent infection in dry seed |
| **28** | **Spinach (Palak)** | ⚠️ Via Advisory | ✅ Yes | Downy mildew, Anthracnose, Cercospora spot, White rust | Downy mildew, Anthracnose papery spots, Cercospora spot, White rust | Pre-emergence damping off before seedling emerges |
| **29** | **Fenugreek (Methi)** | ⚠️ Via Advisory | ✅ Yes | Powdery mildew, Cercospora spot, Downy mildew, Rust | Powdery mildew, Cercospora leaf spot, Downy mildew, Rust | Soil-borne Rhizoctonia root decay before seedling death |

---

## Actionable Recommendations to Expand Tier 1 Offline Coverage
1. **Train Phase-2 PyTorch Weights:** Incorporate the 22 Tier 2 crops (Pulses, Cucurbits, Vegetables) into the offline CNN/ViT model so farmers in remote areas with zero internet connectivity can diagnose all 29 crops completely offline.
2. **Multi-Angle Root & Fruit Scanning:** Add guidance prompts in the scanning camera UI instructing farmers: *"For wilting plants, take a close-up photo of the taproot collar; for cucurbits/okra, take a photo of the cut fruit to detect internal borers."*
