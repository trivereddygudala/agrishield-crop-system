import React from 'react';
import { SmartTractor, AgriDrone, Greenhouse, SolarPanels, WindTurbines, SmartSprinklers, HarvestRobot, ConveyorBelt, CropRows, FencePatrol, AutoSteer, DroneSwarm, SmartSilo, AgriBotV2, LidarScan, GPSTrack, AutoHarvester, RoboWeed, LaserLevel, YieldMonitor } from './scenes/PrecisionAgri';
import { SeedSprouting, Photosynthesis, ChlorophyllFlow, RootsGrowing, WheatField, SunflowerTrack, FruitRipening, Pollination, LeafUnfurl, CellDivision, GeneEdit, DNAHelix, MitoFlow, PlantCell, StomataOpen, RootHair, StemXylem, FlowerBloom, FruitSet, SeedPod } from './scenes/CropBiology';
import { DiseaseScan, SporeAlert, AiDiagnosis, MicroscopeView, HealthSpectrum, LeafXray, PathogenTrack, ConfidenceMeter, ImageClassify, ModelTraining, VirusTrace, BacteriaScan, FungiSpores, NematodeAlert, BlightZone, RustAlert, MildewScan, LesionDetect, SpectralScan, BioAssay } from './scenes/DiseaseDetection';
import { GentleRain, HeavyStorm, Snowfall, MistyMorning, GoldenSunrise, PurpleSunset, HeatwaveShimmer, RainbowArc, WindGusts, CloudDrift, Tornado, Hailstorm, FrostWarning, DewDrop, MonsoonRain, DroughtHeat, Microclimate, Barometer, WindRose, OzoneLayer } from './scenes/WeatherClimate';
import { SoilLayers, MoistureGradient, MineralCrystals, EarthwormTunnel, ErosionFlow, CompostCycle, TopoContours, VolcanicSoil, DesertDunes, PermafrostThaw, NitrogenFix, Phosphorus, Potassium, Microbiome, Mycorrhizae, HumusLayer, ClayParticles, SiltFlow, SandTexture, Bedrock } from './scenes/SoilEarth';
import { Esp32Pulse, SensorArray, BluetoothPair, WifiBroadcast, OtaUpdate, TelemetryFeed, BatteryCharge, CircuitBoard, GatewayNode, EdgeCompute, LoraNode, SigfoxHub, NBIoT, Farm5G, RFIDTag, CameraFeed, Thermistor, StrainGauge, Actuator, SolarBattery } from './scenes/IoTHardware';
import { DripIrrigation, RiverFlow, WaterPump, HydroponicSystem, ReservoirFill, CanalNetwork, RainHarvest, FloodWarning, WaterQuality, Fogponics, Aquifer, CenterPivot, MicroSprinkler, FurrowFlow, FloodGate, DamRelease, EvapoRate, SoilTension, PipePressure, FilterWash } from './scenes/WaterIrrigation';
import { ButterflyGarden, HoneybeeHive, BirdMigration, FireflyNight, FrogPond, LadybugPatrol, SpiderWeb, BambooForest, CherryBlossom, CoralReef, BatFlight, MothHover, EarthwormCrawl, SnailPace, AntColony, AphidCluster, PredatorWasp, PrayingMantis, OwlNight, FoxPatrol } from './scenes/NatureEcosystem';
import { NeuralNetwork, YieldChart, DataStream, RadarSweep, BiometricPulse, PieChartSpin, BarGraphRise, ScatterPlot, HeatmapGrid, FlowDiagram, Surface3D, BubbleChart, LineTrend, BoxPlot, ViolinPlot, AreaGraph, FunnelData, GaugeMeter, KpiBoard, NodeGraph } from './scenes/DataVisualization';
import { AuroraBorealis, LiquidChrome, GlassmorphicOrbs, DeepSpace, AbyssalBlue, NeonEdge, CarbonFiber, VercelDark, HyperSpeed, SonicWave, QuantumFluct, NeonGrid, HoloCore, SynthWave, CyberFluid, PrismLight, TesseractSpin, DarkMatter, PlasmaFlow, NovaBurst } from './scenes/PremiumAbstract';
import { WelcomeFarmer, WelcomeAdmin, WelcomeTester } from './NavbarScenesLibrary';

const SceneWrapper = ({ children, isCompact = false }) => (
  <div className={`relative h-14 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 border border-slate-200/50 dark:border-slate-700/50 hidden lg:block mx-4 transition-all duration-300 ${
    isCompact ? 'w-40 xl:w-48' : 'w-64 md:w-80'
  }`}>
    {children}
  </div>
);

const SCENE_MAP = {
  'smart-tractor': SmartTractor, 'agri-drone': AgriDrone, 'greenhouse': Greenhouse, 'solar-panels': SolarPanels, 'wind-turbine': WindTurbines,
  'smart-sprinklers': SmartSprinklers, 'harvest-robot': HarvestRobot, 'conveyor-belt': ConveyorBelt, 'crop-rows': CropRows, 'fence-patrol': FencePatrol,
  'seed-sprouting': SeedSprouting, 'photosynthesis': Photosynthesis, 'chlorophyll-flow': ChlorophyllFlow, 'roots-growing': RootsGrowing, 'wheat-field': WheatField,
  'sunflower-track': SunflowerTrack, 'fruit-ripening': FruitRipening, 'pollination': Pollination, 'leaf-unfurl': LeafUnfurl, 'cell-division': CellDivision,
  'disease-scan': DiseaseScan, 'spore-alert': SporeAlert, 'ai-diagnosis': AiDiagnosis, 'microscope-view': MicroscopeView, 'health-spectrum': HealthSpectrum,
  'leaf-xray': LeafXray, 'pathogen-track': PathogenTrack, 'confidence-meter': ConfidenceMeter, 'image-classify': ImageClassify, 'model-training': ModelTraining,
  'gentle-rain': GentleRain, 'heavy-storm': HeavyStorm, 'snowfall': Snowfall, 'misty-morning': MistyMorning, 'golden-sunrise': GoldenSunrise,
  'purple-sunset': PurpleSunset, 'heatwave': HeatwaveShimmer, 'rainbow-arc': RainbowArc, 'wind-gusts': WindGusts, 'cloud-drift': CloudDrift,
  'soil-layers': SoilLayers, 'moisture-gradient': MoistureGradient, 'mineral-crystals': MineralCrystals, 'earthworm-tunnel': EarthwormTunnel, 'erosion-flow': ErosionFlow,
  'compost-cycle': CompostCycle, 'topo-contours': TopoContours, 'volcanic-soil': VolcanicSoil, 'desert-dunes': DesertDunes, 'permafrost-thaw': PermafrostThaw,
  'esp32-pulse': Esp32Pulse, 'sensor-array': SensorArray, 'bluetooth-pair': BluetoothPair, 'wifi-broadcast': WifiBroadcast, 'ota-update': OtaUpdate,
  'telemetry-feed': TelemetryFeed, 'battery-charge': BatteryCharge, 'circuit-board': CircuitBoard, 'gateway-node': GatewayNode, 'edge-compute': EdgeCompute,
  'drip-irrigation': DripIrrigation, 'river-flow': RiverFlow, 'water-pump': WaterPump, 'hydroponic-system': HydroponicSystem, 'reservoir-fill': ReservoirFill,
  'canal-network': CanalNetwork, 'rain-harvest': RainHarvest, 'flood-warning': FloodWarning, 'water-quality': WaterQuality, 'fogponics': Fogponics,
  'butterfly-garden': ButterflyGarden, 'honeybee-hive': HoneybeeHive, 'bird-migration': BirdMigration, 'firefly-night': FireflyNight, 'frog-pond': FrogPond,
  'ladybug-patrol': LadybugPatrol, 'spider-web': SpiderWeb, 'bamboo-forest': BambooForest, 'cherry-blossom': CherryBlossom, 'coral-reef': CoralReef,
  'neural-network': NeuralNetwork, 'yield-chart': YieldChart, 'data-stream': DataStream, 'radar-sweep': RadarSweep, 'biometric-pulse': BiometricPulse,
  'pie-chart': PieChartSpin, 'bar-graph': BarGraphRise, 'scatter-plot': ScatterPlot, 'heatmap-grid': HeatmapGrid, 'flow-diagram': FlowDiagram,
  'aurora-borealis': AuroraBorealis, 'liquid-chrome': LiquidChrome, 'glass-orbs': GlassmorphicOrbs, 'deep-space': DeepSpace, 'abyssal-blue': AbyssalBlue,
  'neon-edge': NeonEdge, 'carbon-fiber': CarbonFiber, 'vercel-dark': VercelDark, 'hyper-speed': HyperSpeed, 'sonic-wave': SonicWave,
  'welcome-farmer': WelcomeFarmer, 'welcome-admin': WelcomeAdmin, 'welcome-tester': WelcomeTester,
  
  // Phase 2 Expansion
  'pa-11': AutoSteer,
  'pa-12': DroneSwarm,
  'pa-13': SmartSilo,
  'pa-14': AgriBotV2,
  'pa-15': LidarScan,
  'pa-16': GPSTrack,
  'pa-17': AutoHarvester,
  'pa-18': RoboWeed,
  'pa-19': LaserLevel,
  'pa-20': YieldMonitor,
  'cb-11': GeneEdit,
  'cb-12': DNAHelix,
  'cb-13': MitoFlow,
  'cb-14': PlantCell,
  'cb-15': StomataOpen,
  'cb-16': RootHair,
  'cb-17': StemXylem,
  'cb-18': FlowerBloom,
  'cb-19': FruitSet,
  'cb-20': SeedPod,
  'dd-11': VirusTrace,
  'dd-12': BacteriaScan,
  'dd-13': FungiSpores,
  'dd-14': NematodeAlert,
  'dd-15': BlightZone,
  'dd-16': RustAlert,
  'dd-17': MildewScan,
  'dd-18': LesionDetect,
  'dd-19': SpectralScan,
  'dd-20': BioAssay,
  'wc-11': Tornado,
  'wc-12': Hailstorm,
  'wc-13': FrostWarning,
  'wc-14': DewDrop,
  'wc-15': MonsoonRain,
  'wc-16': DroughtHeat,
  'wc-17': Microclimate,
  'wc-18': Barometer,
  'wc-19': WindRose,
  'wc-20': OzoneLayer,
  'se-11': NitrogenFix,
  'se-12': Phosphorus,
  'se-13': Potassium,
  'se-14': Microbiome,
  'se-15': Mycorrhizae,
  'se-16': HumusLayer,
  'se-17': ClayParticles,
  'se-18': SiltFlow,
  'se-19': SandTexture,
  'se-20': Bedrock,
  'ih-11': LoraNode,
  'ih-12': SigfoxHub,
  'ih-13': NBIoT,
  'ih-14': Farm5G,
  'ih-15': RFIDTag,
  'ih-16': CameraFeed,
  'ih-17': Thermistor,
  'ih-18': StrainGauge,
  'ih-19': Actuator,
  'ih-20': SolarBattery,
  'wi-11': Aquifer,
  'wi-12': CenterPivot,
  'wi-13': MicroSprinkler,
  'wi-14': FurrowFlow,
  'wi-15': FloodGate,
  'wi-16': DamRelease,
  'wi-17': EvapoRate,
  'wi-18': SoilTension,
  'wi-19': PipePressure,
  'wi-20': FilterWash,
  'ne-11': BatFlight,
  'ne-12': MothHover,
  'ne-13': EarthwormCrawl,
  'ne-14': SnailPace,
  'ne-15': AntColony,
  'ne-16': AphidCluster,
  'ne-17': PredatorWasp,
  'ne-18': PrayingMantis,
  'ne-19': OwlNight,
  'ne-20': FoxPatrol,
  'dv-11': Surface3D,
  'dv-12': BubbleChart,
  'dv-13': LineTrend,
  'dv-14': BoxPlot,
  'dv-15': ViolinPlot,
  'dv-16': AreaGraph,
  'dv-17': FunnelData,
  'dv-18': GaugeMeter,
  'dv-19': KpiBoard,
  'dv-20': NodeGraph,
  'pa2-11': QuantumFluct,
  'pa2-12': NeonGrid,
  'pa2-13': HoloCore,
  'pa2-14': SynthWave,
  'pa2-15': CyberFluid,
  'pa2-16': PrismLight,
  'pa2-17': TesseractSpin,
  'pa2-18': DarkMatter,
  'pa2-19': PlasmaFlow,
  'pa2-20': NovaBurst,
};

const NavbarSceneRenderer = ({ theme, noWrapper = false, isCompact = false }) => {
  const Scene = SCENE_MAP[theme] || AuroraBorealis;
  if (noWrapper) return <Scene isCompact={isCompact} />;
  return <SceneWrapper isCompact={isCompact}><Scene isCompact={isCompact} /></SceneWrapper>;
};

export default NavbarSceneRenderer;
