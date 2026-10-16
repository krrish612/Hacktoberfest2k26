(() => {
  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = year;
  });

  const topbar = document.getElementById("topbar");
  const onScroll = () => {
    if (topbar) topbar.classList.toggle("is-stuck", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const track = document.querySelector("[data-marquee]");
  if (track) {
    track.innerHTML += track.innerHTML;
  }

  const reveals = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );
    reveals.forEach((el) => io.observe(el));
  }

  const cookie = document.getElementById("cookie");
  const KEY = "sp-cookie-ack";
  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  if (cookie && !stored) {
    window.setTimeout(() => {
      cookie.hidden = false;
    }, 900);
  }
  cookie?.querySelectorAll("[data-cookie]").forEach((btn) => {
    btn.addEventListener("click", () => {
      try {
        localStorage.setItem(KEY, btn.getAttribute("data-cookie") || "ack");
      } catch {
        /* storage unavailable; banner simply can reappear */
      }
      cookie.hidden = true;
    });
  });
})();
