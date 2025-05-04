const container = document.querySelector(".container");
const signinForm = document.querySelector(".signin-form");
const loginForm = document.querySelector(".login-form");
const toggleLogin = document.getElementById("toggle-login");
const toggleSignin = document.getElementById("toggle-signin");
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

toggleLogin.addEventListener("click", (e) => {
  e.preventDefault();
  signinForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  container.classList.add("pulse");
  setTimeout(() => container.classList.remove("pulse"), 500);
});

toggleSignin.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  signinForm.classList.remove("hidden");
  container.classList.add("pulse");
  setTimeout(() => container.classList.remove("pulse"), 500);
});

themeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  container.classList.add("shake");
  setTimeout(() => container.classList.remove("shake"), 500);
});

const errorModal = document.getElementById("errorModal");
const errorMessage = document.getElementById("errorMessage");
const closeBtn = document.querySelector(".close-btn");

function showError(message) {
  errorMessage.textContent = message;
  errorModal.style.display = "block";
}

function handleFormSubmit(form, url) {
  return async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        showError(result.message);
      } else {
        window.location.href = result.redirect;
      }
    } catch (err) {
      showError("Network error. Please try again.");
    }
  };
}


document
  .querySelector(".login-form")
  .addEventListener(
    "submit",
    handleFormSubmit(document.querySelector(".login-form"), "/login")
  );

document
  .querySelector(".signin-form")
  .addEventListener(
    "submit",
    handleFormSubmit(document.querySelector(".signin-form"), "/register")
  );


closeBtn.addEventListener("click", () => {
  errorModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === errorModal) {
    errorModal.style.display = "none";
  }
});