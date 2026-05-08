"use client";

import { useState, type ComponentType } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CircuitBoard,
  Cuboid,
  ExternalLink,
  Mail,
  MapPin,
  Play,
  Trophy,
} from "lucide-react";
import { useGameState } from "@/components/providers/GameStateProvider";
import { TopicSelect } from "@/components/screens/TopicSelect";
import { PinEntry } from "@/components/screens/PinEntry";
import { TaskList } from "@/components/screens/TaskList";
import { TaskDetail } from "@/components/screens/TaskDetail";
import { StyleShop } from "@/components/screens/StyleShop";
import { AvatarShop } from "@/components/screens/AvatarShop";
import { LevelBadges } from "@/components/screens/LevelBadges";
import { isTopicEnabled } from "@/lib/topics";
import type { ScreenState } from "@/types";

const SCREENS: Record<ScreenState["currentScreen"], ComponentType> = {
  "topic-select": TopicSelect,
  "pin-entry":    PinEntry,
  "task-list":    TaskList,
  "task-detail":  TaskDetail,
  "style-shop":   StyleShop,
  "avatar-shop":  AvatarShop,
  "level-badges": LevelBadges,
  "admin":        PinEntry, // /admin route handles its own UI
};

function ClassroomApp({ onBackToLanding }: { onBackToLanding: () => void }) {
  const { state } = useGameState();

  // Hard gate: no topic selected (or topic now disabled) → always TopicSelect.
  if (!state.selectedTopic || !isTopicEnabled(state.selectedTopic)) {
    return (
      <AnimatePresence mode="wait">
        <TopicSelect key="topic-select" onBackToLanding={onBackToLanding} />
      </AnimatePresence>
    );
  }

  const key = state.screen.currentScreen;
  if (key === "topic-select") {
    return (
      <AnimatePresence mode="wait">
        <TopicSelect key="topic-select" onBackToLanding={onBackToLanding} />
      </AnimatePresence>
    );
  }

  const Component = SCREENS[key] ?? PinEntry;
  return (
    <AnimatePresence mode="wait">
      <Component key={key} />
    </AnimatePresence>
  );
}

function ShowcaseBoard() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
      <article className="rounded-[18px] border border-white/12 bg-white/[0.06] p-4 shadow-2xl shadow-black/20 backdrop-blur md:col-span-2 xl:col-span-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8ff3d8]">Chytrá elektronika</p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Navazuje na Arduino i Weeks sady</h2>
          </div>
          <span className="rounded-full bg-[#71b0ff]/18 px-3 py-1 text-sm font-bold text-[#a8d0ff]">HW + lekce</span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr] xl:grid-cols-1 2xl:grid-cols-[0.92fr_1.08fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07111f]">
            <img
              src="https://weeks.cz/images/gallery/iot-arduino-breadboard.jpg"
              alt="Arduino sada pro Weeks Učebnu"
              className="h-44 w-full object-cover lg:h-full xl:h-44 2xl:h-full"
            />
          </div>
          <div className="flex flex-col justify-between gap-4">
            <p className="text-sm leading-6 text-white/62">
              Učebna počítá s reálným Arduino hardwarem a přesně navazuje na naše IoT sady. Mladí tvůrci tak nestaví náhodné pokusy, ale postupují podle projektů, které sedí k součástkám doma.
            </p>
            <a
              href="https://weeks.cz/eshop"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2dd4a6] px-4 py-3 text-sm font-black text-[#07111f] transition hover:bg-[#6bf0cb]"
            >
              Prohlédnout sady
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { level: "Reálné zapojení", text: "Arduino, breadboard, senzory" },
            { level: "Jasný postup", text: "úkoly odpovídají sadám" },
            { level: "Další úroveň", text: "od LED až po IoT scénáře" },
          ].map((item) => (
            <div key={item.level} className="rounded-2xl border border-white/10 bg-[#07111f]/55 p-3">
              <p className="text-sm font-black text-white">{item.level}</p>
              <p className="mt-2 text-xs leading-5 text-white/52">{item.text}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="overflow-hidden rounded-[18px] border border-white/12 bg-white/[0.06] p-4 md:col-span-2 xl:col-span-7">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#71b0ff]">3D tisk</p>
        <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Modelovací Studio</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
          <img
            src="/landing/modelovaci-studio.png"
            alt="Modelovací Studio ve Weeks Učebně"
            className="block h-auto w-full"
          />
        </div>
      </article>

      <article className="rounded-[18px] border border-white/12 bg-white/[0.06] p-4 md:col-span-2 xl:col-span-12">
        <div className="grid gap-5 xl:grid-cols-[0.42fr_0.58fr] xl:items-stretch">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2dd4a6]">Simulátory</p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Zapojování i bez fyzické sady</h2>
            <p className="mt-3 text-sm leading-6 text-white/58">
              Když není po ruce hardware, mladý tvůrce může pracovat v online prostředí. Přetáhne součástky, propojí vodiče a pochopí princip ještě před tím, než vezme do ruky reálné Arduino.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Arduino", "Breadboard", "LED", "Senzory", "Vodiče"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-[#07111f]/70 px-3 py-1 text-xs font-bold text-white/66">{item}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.45fr_0.72fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] p-3">
              <img
                src="/landing/weeks-sady.png"
                alt="Online zapojování ve Weeks Učebně"
                className="h-56 w-full rounded-xl object-cover sm:h-64 lg:h-full lg:min-h-60"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
              <p className="text-sm font-bold text-white/62">Jak se s tím pracuje</p>
              <div className="mt-3 space-y-2">
                {["Poskládá obvod online", "Vyzkouší, co se stane", "Přenese zapojení na stůl"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2dd4a6] text-xs font-black text-[#07111f]">{index + 1}</span>
                    <span className="text-sm font-bold text-white/72">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function LandingFooter() {
  const navigationLinks = [
    { name: "Program", href: "https://weeks.cz/program" },
    { name: "E-shop", href: "https://weeks.cz/eshop" },
    { name: "Proč Weeks", href: "https://weeks.cz/#proc-weeks" },
    { name: "O nás", href: "https://weeks.cz/o-nas" },
    { name: "Kontakt", href: "https://weeks.cz/kontakt" },
  ];

  const legalLinks = [
    { name: "Ochrana osobních údajů", href: "https://weeks.cz/gdpr" },
    { name: "Podmínky užití", href: "https://weeks.cz/podminky" },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#050b16] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(113,176,255,0.16),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(45,212,166,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:px-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <a href="https://weeks.cz" className="mb-6 flex items-center gap-3">
              <img
                src="https://weeks.cz/images/weeks-logo.png"
                alt="Weeks"
                className="h-10 w-10 rounded-xl bg-white object-contain p-1.5"
              />
              <span className="text-xl font-black text-white">Weeks</span>
            </a>
            <p className="text-sm leading-6 text-white/58">
              Víkendové IT kempy, IoT sady a online Učebna pro mladé tvůrce, kteří chtějí stavět vlastní projekty doma i na táborech.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["DDM Praha 6", "HWLab", "Weeks Učebna"].map((item) => (
                <span key={item} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/66">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white">Navigace</h3>
            <ul className="mt-5 space-y-3">
              {navigationLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="group inline-flex items-center gap-2 text-sm text-white/58 transition hover:text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/24 transition group-hover:bg-[#71b0ff]" />
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white">Právní informace</h3>
            <ul className="mt-5 space-y-3">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="group inline-flex items-center gap-2 text-sm text-white/58 transition hover:text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/24 transition group-hover:bg-[#71b0ff]" />
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white">Kontakt</h3>
            <ul className="mt-5 space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#71b0ff]" />
                <span className="text-sm leading-6 text-white/58">
                  <span className="font-bold text-white/78">HWLab Praha</span>
                  <br />
                  5. května 11, Praha 4
                </span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#71b0ff]" />
                <span className="text-sm leading-6 text-white/58">
                  <span className="font-bold text-white/78">DDM Praha 6</span>
                  <br />
                  U Boroviček 5, Praha 6
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-[#71b0ff]" />
                <a href="mailto:info@weeks.cz" className="text-sm text-white/58 transition hover:text-white">
                  info@weeks.cz
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/48 md:flex-row md:items-center md:justify-between">
          <p>{new Date().getFullYear()} Weeks. Všechna práva vyhrazena.</p>
          <a href="https://weeks.cz" className="inline-flex items-center gap-2 transition hover:text-white">
            Zpět na weeks.cz
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const features = [
    {
      icon: CircuitBoard,
      title: "Chytrá elektronika navázaná na sady",
      text: "Mladí tvůrci postupují od LED a tlačítek přes senzory až k domácím IoT scénářům, které dávají smysl se Starter sadou, Home Labem i navazujícími kity.",
    },
    {
      icon: Cuboid,
      title: "3D modelovací Studio",
      text: "Vlastní prostředí inspirované Tinkercadem: základní tvary, měřítko, manipulace v prostoru a export modelů pro 3D tisk.",
    },
    {
      icon: BrainCircuit,
      title: "Úkoly, nápovědy a validace",
      text: "Učebna vede mladé tvůrce po konkrétních úkolech, nabízí nápovědu k zapojení i kódu a drží postup přehledně v úrovních.",
    },
    {
      icon: Trophy,
      title: "Motivace, která táhne dál",
      text: "Hvězdičky, avatary, styly, odemykání pokročilých částí a denní výzvy dělají z domácího učení hru.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="relative overflow-hidden px-4 pb-12 pt-28 sm:px-6 sm:pt-32 md:px-8 lg:px-12 2xl:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(113,176,255,0.24),transparent_28%),radial-gradient(circle_at_78%_8%,rgba(45,212,166,0.14),transparent_22%),linear-gradient(180deg,#0a1528_0%,#07111f_58%,#0b1220_100%)]" />
        <div className="relative mx-auto max-w-[1840px]">
          <nav className="fixed left-4 right-4 top-3 z-50 mx-auto flex max-w-[1840px] items-center justify-between rounded-2xl border border-white/10 bg-[#07111f]/72 px-3 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:left-6 sm:right-6 sm:px-4 md:left-8 md:right-8 lg:left-12 lg:right-12 2xl:left-16 2xl:right-16">
            <div className="flex items-center gap-3">
              <img
                src="https://weeks.cz/images/weeks-logo.png"
                alt="Weeks"
                className="h-10 w-10 rounded-xl bg-white object-contain p-1.5 sm:h-12 sm:w-12"
              />
              <div>
                <p className="text-base font-black tracking-tight sm:text-lg">Weeks Učebna</p>
                <p className="hidden text-xs text-white/45 min-[420px]:block">technologie pro mladé tvůrce doma i na táborech</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onEnter}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#07111f] transition hover:bg-[#d7e9ff] sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <span className="hidden min-[420px]:inline">Vstup do Učebny</span>
                <span className="min-[420px]:hidden">Vstup</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </nav>

          <div className="grid gap-8 py-6 md:py-8 2xl:grid-cols-[minmax(430px,0.64fr)_minmax(0,1.36fr)] 2xl:items-start 2xl:py-10">
            <div className="2xl:pt-12">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70 sm:mb-6 sm:px-4 sm:text-sm">
                <BadgeCheck className="h-4 w-4 text-[#2dd4a6]" />
                <span>Navazuje na Weeks sady, kity a projekty</span>
              </div>
              <h1 className="max-w-4xl text-[clamp(2.45rem,6vw,4rem)] font-black leading-[0.98] tracking-tight text-white 2xl:max-w-3xl 2xl:text-[clamp(3rem,3.25vw,4rem)]">
                Učebna, která mladé tvůrce provede světem technologií přes vlastní projekty.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/64 sm:mt-6 sm:text-lg sm:leading-8 2xl:text-base 2xl:leading-7">
                Vybereš si téma, otevřeš projekt a postupuješ krok za krokem. Zapojíš elektroniku, navrhneš 3D model, zkusíš kód a za hotové úkoly sbíráš odměny.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <button
                  type="button"
                  onClick={onEnter}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#71b0ff] px-5 py-3 font-black text-[#07111f] shadow-xl shadow-[#71b0ff]/20 transition hover:bg-[#9fcbff] sm:px-6"
                >
                  Vstup do Učebny
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("obsah")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-white/65 transition hover:bg-white/8 hover:text-white"
                >
                  Co v ní je
                  <Play className="h-4 w-4" />
                </button>
              </div>

            </div>

            <ShowcaseBoard />
          </div>
        </div>
      </section>

      <section id="obsah" className="border-y border-white/10 bg-[#0b1220] px-4 py-12 sm:px-6 md:px-8 md:py-16 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#71b0ff]">Co v Učebně je</p>
              <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">Jedno místo pro elektroniku, modelování a dlouhodobý postup.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-white/54">
              Projekty, zapojování, kód, 3D tvorba i uložený postup jsou na jednom místě. Mladí tvůrci tak nemusí přeskakovat mezi návody, součástkami a poznámkami.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <feature.icon className="h-6 w-6 text-[#71b0ff]" />
                <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 md:px-8 md:py-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] p-3">
            <img
              src="https://weeks.cz/images/gallery/iot-plant-sensor.jpg"
              alt="Weeks IoT projekt zapojený u rostliny"
              className="h-72 w-full rounded-[20px] object-cover sm:h-96"
            />
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#2dd4a6]">Weeks sady</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">Vlastní hardware, který do Učebny přesně zapadá.</h2>
            <p className="mt-4 text-base leading-7 text-white/58">
              Sady, kity a malé projekty jsou připravené tak, aby na Učebnu navazovaly bez shánění náhodných součástek. Celá sada je pro nový start, navazující kit přidá další úroveň bez duplicit a malý projekt odemkne jednu konkrétní lekci.
            </p>
            <p className="mt-3 text-base leading-7 text-white/58">
              Po rozbalení tak můžeš rovnou otevřít projekt, zapojit komponenty a postupovat podle lekce, která počítá s výbavou na stole.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Celé sady", "Kompletní balení včetně desky, breadboardu, kabelů a lekcí."],
                ["Navazující kity", "Další level pro ty, kteří už mají základní výbavu doma."],
                ["Malé projekty", "Levnější balíčky pro jednu konkrétní lekci v Učebně."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <h3 className="font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/54">{text}</p>
                </div>
              ))}
            </div>

            <a
              href="https://weeks.cz/eshop"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2dd4a6] px-6 py-3 font-black text-[#07111f] transition hover:bg-[#6bf0cb]"
            >
              Prohlédnout sady v e-shopu
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}

export default function HomePage() {
  const [showClassroom, setShowClassroom] = useState(false);

  if (showClassroom) {
    return <ClassroomApp onBackToLanding={() => setShowClassroom(false)} />;
  }

  return <LandingPage onEnter={() => setShowClassroom(true)} />;
}
