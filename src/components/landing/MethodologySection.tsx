import { Camera, RefreshCw, Upload, MapPin, Flag, Zap, ShieldCheck, Footprints } from "lucide-react";
import { GlassPanel } from "@/components/shared/GlassPanel";

export function MethodologySection() {
  const captureSteps = [
    {
      icon: Footprints,
      text: "Carry a 360 camera to a race",
    },
    {
      icon: Zap,
      text: "Set interval photo mode on a 10s timer",
    },
    {
      icon: Flag,
      text: "Run the entire track from start to finish",
    },
  ];

  const processSteps = [
    {
      icon: RefreshCw,
      text: "Gyro-stabilize to keep the view facing forward",
    },
    {
      icon: ShieldCheck,
      text: "AI-driven face and plate blurring for privacy",
    },
    {
      icon: Upload,
      text: "Generate equirectangular tiles and sync to DB",
    },
    {
      icon: MapPin,
      text: "Map GPX coordinates to the image sequence",
    },
    {
      icon: Flag,
      text: "New route is published and ready to scout",
    },
  ];

  return (
    <section className="py-24 bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            How it Works
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            From the first kilometer to the final upload, here is how we bring the race to your screen.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Capture Card */}
          <GlassPanel className="p-8 border-coral/20 bg-coral/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-coral/20 rounded-lg">
                <Camera className="h-6 w-6 text-coral" />
              </div>
              <h3 className="text-2xl font-bold text-white">Capture</h3>
            </div>
            
            <ul className="space-y-6">
              {captureSteps.map((step, idx) => (
                <li key={idx} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/5 rounded flex items-center justify-center">
                    <step.icon className="h-4 w-4 text-slate-300" />
                  </div>
                  <span className="text-slate-300 leading-snug">{step.text}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>

          {/* Process Card */}
          <GlassPanel className="p-8 border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <RefreshCw className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">Processing</h3>
            </div>

            <ul className="space-y-6">
              {processSteps.map((step, idx) => (
                <li key={idx} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/5 rounded flex items-center justify-center">
                    <step.icon className="h-4 w-4 text-slate-300" />
                  </div>
                  <span className="text-slate-300 leading-snug">{step.text}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}
