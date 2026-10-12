// Thinking modes for "Copy for Claude". Pure text, nothing is sent anywhere.
export const MODES = ['answer', 'challenge', 'pattern', 'brainstorm'];
const LABEL = { answer: 'Answer', challenge: 'Challenge', pattern: 'Pattern', brainstorm: 'Brainstorm' };
const TEXT = {
  answer: 'Answer using only the notes below. Say so if something is missing.',
  challenge: 'Challenge my thinking using the notes below. Name the assumptions I am making, the weakest points, and the strongest counter-arguments. Quote the note each point comes from. Do not be polite for its own sake.',
  pattern: 'Look for patterns across the notes below. List recurring themes, repeated mistakes, links I have not made and contradictions between notes. Name the notes behind each pattern.',
  brainstorm: 'Brainstorm with me, starting from the notes below. Give a spread of new ideas and options, from safe to bold, and say which note each one builds on. Ask me one question at the end.',
};
export const isMode = (m) => MODES.includes(m);
export const modeLabel = (m) => LABEL[m] || LABEL.answer;
export const modeInstruction = (m) => TEXT[isMode(m) ? m : 'answer'];
