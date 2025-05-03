let text = `hi ${userId} i am your personal bot`
let text2 = "to call me press B";
let text3="for any query ask me in the chat box by slecting bot"


function textToSpeech(text, cb) {
  const speech = new SpeechSynthesisUtterance();
  speech.rate = 0.8;
  speech.pitch = 1;
  speech.volume = 1;

  const voices = speechSynthesis.getVoices();
  speech.voice = voices.find((v) => v.name.includes("Google")) || voices[0];

  speech.text = text;
  if (cb) speech.onend = cb;

  speechSynthesis.speak(speech);
}

setTimeout(() => {
  textToSpeech(text, () => {
    textToSpeech(text2, () => {
      textToSpeech(text3);
    });
  });
}, 2000);

