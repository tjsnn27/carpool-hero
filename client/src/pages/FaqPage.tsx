import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { FAQ } from '../content/faq';

function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 border-stone-900 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left font-black text-stone-900 hover:bg-amber-50"
      >
        <span>{question}</span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-stone-700 leading-relaxed border-t-2 border-stone-200 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <HelpCircle className="text-brand-700" size={32} />
        <div>
          <h1 className="text-2xl font-black text-stone-900">How Carpool Hero Works</h1>
          <p className="text-sm font-bold text-stone-600">Agasthiyar Academy — Privacy-first dismissal</p>
        </div>
      </div>

      <div className="bg-brand-100 border-3 border-brand-700 rounded-2xl p-4 text-sm font-medium text-brand-950">
        Carpool Hero is designed like leading carpool apps: automatic classroom notification when you arrive,
        without tracking your location. Volunteers with keypad check-in provide a fallback for drivers without smartphones.
      </div>

      <div className="space-y-3">
        {FAQ.map((item) => (
          <FaqAccordion key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  );
}
