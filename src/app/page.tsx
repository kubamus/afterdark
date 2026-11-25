import { FinalAct } from "@/components/FinalAct";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { InstrumentAct } from "@/components/InstrumentAct";
import { MomentAct } from "@/components/MomentAct";
import { CdjAct, DjmAct } from "@/components/ProductAct";
import { ExperienceProvider } from "@/components/StageCanvas";

export default function HomePage() {
  return (
    <ExperienceProvider>
      <Header />
      <main id="main-content">
        <Hero />
        <InstrumentAct />
        <CdjAct />
        <DjmAct />
        <MomentAct />
        <FinalAct />
      </main>
    </ExperienceProvider>
  );
}
