(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  // staged hero entrance, after fonts settle to avoid a flash of unstyled type
  const load = () => document.documentElement.classList.add("is-loaded");
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(load));
    window.setTimeout(load, 1200);
  } else {
    requestAnimationFrame(load);
  }

  // seamless marquee: duplicate the track so the -50% loop is invisible
  const track = document.querySelector("[data-marquee]");
  if (track) track.innerHTML += track.innerHTML;

  const topbar = document.getElementById("topbar");

  // scroll pipeline: one rAF, transform/opacity only
  const progress = document.querySelector("[data-progress]");
  const parallax = [...document.querySelectorAll("[data-parallax]")];
  let ticking = false;

  const apply = () => {
    ticking = false;
    const y = window.scrollY;

    if (topbar) topbar.classList.toggle("is-stuck", y > 24);

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    }

    if (!reduced && window.innerWidth > 900) {
      for (const el of parallax) {
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2 - window.innerHeight / 2;
        const shift = -mid * parseFloat(el.getAttribute("data-parallax") || "0");
        el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
      }
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  apply();

  // progressive reveals
  const reveals = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));
  }

  // magnetic buttons: small, spring-ish pull toward the cursor
  if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const STRENGTH = 0.28;
    const MAX = 10;
    for (const btn of document.querySelectorAll("[data-magnetic]")) {
      const move = (e) => {
        const r = btn.getBoundingClientRect();
        const dx = clamp((e.clientX - (r.left + r.width / 2)) * STRENGTH, -MAX, MAX);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) * STRENGTH, -MAX, MAX);
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const reset = () => {
        btn.style.transform = "";
      };
      btn.addEventListener("pointermove", move);
      btn.addEventListener("pointerleave", reset);
      btn.addEventListener("blur", reset);
    }
  }

  // nav scroll-spy
  const navLinks = [...document.querySelectorAll(".nav a")];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (sections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          navLinks.forEach((a) =>
            a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`),
          );
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => spy.observe(s));
  }

  // cookie consent, stored only on the device
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
        /* storage unavailable; the banner may reappear */
      }
      cookie.hidden = true;
    });
  });
})();
