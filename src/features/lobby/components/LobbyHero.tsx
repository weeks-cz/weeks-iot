import { lessonBySlug } from "@/features/lessons/content";
import { heroCopy } from "../copy";
import { heroState } from "../model";
import type { LobbyData } from "../queries";
import { LobbyHeroDraft } from "./LobbyHeroDraft";

/**
 * Hero lobby přihlášeného dítěte.
 *
 * Server zná jen hotové lekce, takže vykreslí stav bez konceptu
 * (`heroState(path, () => null)`) — začni / další / hotovo. Rozdělanou
 * práci doplní `LobbyHeroDraft` po připojení.
 */
export function LobbyHero({
  data,
  childId,
  nick,
  avatar,
}: {
  data: LobbyData;
  childId: string;
  nick: string;
  avatar: string;
}) {
  const state = heroState(data.path, () => null);
  const lesson = state.kind === "done" ? null : lessonBySlug(state.lesson.slug);

  return (
    <LobbyHeroDraft
      profileId={childId}
      state={state}
      labels={heroCopy(state, lesson)}
      course={data.course}
      path={data.path}
      nick={nick}
      avatar={avatar}
      stats={data.stats}
      certificate={data.certificate?.data ?? null}
    />
  );
}
