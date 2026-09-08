import { useState } from 'react';
import { useStore } from './state/store';
import type { ScenarioId } from './types';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Learn } from './screens/Learn';
import { Speak } from './screens/Speak';
import { Review } from './screens/Review';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';
import { FlashcardSession } from './activities/FlashcardSession';
import { PhraseLesson } from './activities/PhraseLesson';
import { ListeningSession } from './activities/ListeningSession';
import { SpeakingSession } from './activities/SpeakingSession';
import { Conversation } from './activities/Conversation';
import { WeeklyChallenge } from './activities/WeeklyChallenge';
import { FinalAssessment } from './activities/FinalAssessment';
import { Recap } from './activities/Recap';

export type Tab = 'today' | 'learn' | 'speak' | 'review' | 'progress' | 'settings';

export type Activity =
  | { kind: 'flashcards'; mode?: 'due' | 'weak' | 'mistakes' | 'all'; ref?: string }
  | { kind: 'phrases'; ref: string }
  | { kind: 'listening'; ref: string; shadowOnly?: boolean }
  | { kind: 'shadowing'; ref: string }
  | { kind: 'speaking'; ref: string }
  | { kind: 'scenario' | 'conversation'; ref: ScenarioId; spanishOnly?: boolean; targetMinutes?: number; challengeWeek?: number }
  | { kind: 'challenge'; ref: string }
  | { kind: 'final' }
  | { kind: 'recap' };

export interface Nav {
  tab: Tab;
  go: (tab: Tab) => void;
  start: (a: Activity) => void;
}

export default function App() {
  const state = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [activity, setActivity] = useState<Activity | null>(null);

  if (!state.onboarded) return <Onboarding />;

  const nav: Nav = { tab, go: setTab, start: setActivity };
  const close = () => setActivity(null);

  return (
    <div className="app">
      {tab === 'today' && <Today nav={nav} />}
      {tab === 'learn' && <Learn nav={nav} />}
      {tab === 'speak' && <Speak nav={nav} />}
      {tab === 'review' && <Review nav={nav} />}
      {tab === 'progress' && <Progress nav={nav} />}
      {tab === 'settings' && <SettingsScreen nav={nav} />}

      <nav className="nav">
        {(
          [
            ['today', '🌴', 'Today'],
            ['learn', '📚', 'Learn'],
            ['speak', '🗣️', 'Speak'],
            ['review', '🧠', 'Review'],
            ['progress', '📈', 'Progress'],
          ] as [Tab, string, string][]
        ).map(([t, icon, label]) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            <span className="icon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {activity?.kind === 'flashcards' && <FlashcardSession mode={activity.mode ?? 'due'} onClose={close} />}
      {activity?.kind === 'phrases' && <PhraseLesson lessonKey={activity.ref} onClose={close} />}
      {activity?.kind === 'listening' && <ListeningSession exerciseId={activity.ref} onClose={close} />}
      {activity?.kind === 'shadowing' && <ListeningSession exerciseId={activity.ref} shadowOnly onClose={close} />}
      {activity?.kind === 'speaking' && <SpeakingSession lessonKey={activity.ref} onClose={close} />}
      {(activity?.kind === 'scenario' || activity?.kind === 'conversation') && (
        <Conversation scenarioId={activity.ref} spanishOnly={activity.spanishOnly} targetMinutes={activity.targetMinutes} challengeWeek={activity.challengeWeek} planKind={activity.kind} onClose={close} />
      )}
      {activity?.kind === 'challenge' && <WeeklyChallenge week={Number(activity.ref)} onClose={close} start={setActivity} />}
      {activity?.kind === 'final' && <FinalAssessment onClose={close} />}
      {activity?.kind === 'recap' && <Recap onClose={close} />}
    </div>
  );
}
