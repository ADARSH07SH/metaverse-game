let editor;
let isMonacoLoaded = false;
let currentRoomId = null;
const lastCodeByRoom = {};

function loadMonacoAndInit(roomId) {
  currentRoomId = roomId;

  if (isMonacoLoaded) {
    initMonaco(roomId);
    return;
  }

  const loaderScript = document.createElement("script");
  loaderScript.src =
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js";
  loaderScript.onload = () => {
    require.config({
      paths: {
        vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
      },
    });

    require(["vs/editor/editor.main"], () => {
      isMonacoLoaded = true;
      initMonaco(roomId);
    });
  };

  document.body.appendChild(loaderScript);
}

function initMonaco(roomId) {
  const container = document.getElementById("editorContainer");
  if (!container) {
    //console.error("Editor container not found!");
    return;
  }

  if (editor) return;

  editor = monaco.editor.create(container, {
    value: lastCodeByRoom[roomId] || "// Start typing code...\n",
    language: "javascript",
    theme: "vs-dark",
    automaticLayout: true,
  });

  editor.onDidChangeModelContent(() => {
    const code = editor.getValue();
    lastCodeByRoom[roomId] = code;
    if (inmycom == true) {
      //console.log("mycode")
    } else {
      socket.emit("editor-change", { roomId, code });
    }
  });

  container.style.display = "block";
  editor.focus();
}

window.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeEditorBtn");
  const editorScreen = document.getElementById("virtualEditorScreen");

  if (!closeBtn || !editorScreen) {
    //console.error("Editor close button or screen not found.");
    return;
  }

  closeBtn.addEventListener("click", () => {
    editorScreen.classList.add("hidden");

    if (editor) {
      lastCodeByRoom[currentRoomId] = editor.getValue();
      editor.dispose();
      editor = null;
    }
  });
  let notes = document.getElementById("notesEditor");

  socket.on("entercode1", ({ userId, roomId }) => {
    //console.log("📥 entercode1 received for", userId, "room:", roomId);
    editorScreen.classList.remove("hidden");
    notes.classList.remove("hidden");
    setTimeout(() => {
      loadMonacoAndInit(roomId);
      editorScreen.focus();
    }, 50);
  });

  socket.on("exitcode1", () => {
    //console.log("📤 exitcode1 received");
    if (editor) {
      lastCodeByRoom[currentRoomId] = editor.getValue();
      editor.dispose();
      editor = null;
    }
    editorScreen.classList.add("hidden");
    notes.classList.add("hidden");
    document.getElementById("game-container").focus();
  });

  socket.on("editor-update", ({ roomId: incomingRoomId, code }) => {
    if (inmycom == true) {
      return;
    }
    if (incomingRoomId === currentRoomId) {
      if (editor && editor.getValue() !== code) {
        const pos = editor.getPosition();
        editor.setValue(code);
        editor.setPosition(pos);
        lastCodeByRoom[incomingRoomId] = code;
      }
    }
  });
});
