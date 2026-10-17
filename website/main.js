(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduced;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const markLoaded = () => document.documentElement.classList.add("is-loaded");

  /* ---------- boot skeleton ---------- */
  const boot = document.getElementById("boot");
  const bootMsg = document.querySelector("[data-boot-msg]");
  const bootBar = document.querySelector("[data-boot-bar]");

  const finishBoot = () => {
    if (!boot || boot.classList.contains("is-done")) return;
    boot.classList.add("is-done");
    markLoaded();
    window.setTimeout(() => boot.remove(), 600);
  };

  if (reduced || !boot) {
    finishBoot();
  } else {
    const messages = [
      "Reticulating splines…",
      "Aligning synergies…",
      "Asking the local model, politely…",
      "Deploying vibes to 127.0.0.1…",
      "Counting cookies (there are none)…",
      "Almost there… probably…",
    ];
    const steps = [14, 32, 27, 51, 74, 71, 93, 100];
    let i = 0;
    let s = 0;
    const tick = window.setInterval(() => {
      if (bootMsg) bootMsg.textContent = messages[i % messages.length];
      i += 1;
    }, 480);
    const grow = window.setInterval(() => {
      if (bootBar) bootBar.style.width = `${steps[s] ?? 100}%`;
      s += 1;
      if (s >= steps.length) {
        window.clearInterval(grow);
        window.setTimeout(finishBoot, 700);
      }
    }, 320);
    boot.querySelector("[data-boot-skip]")?.addEventListener("click", () => {
      window.clearInterval(tick);
      window.clearInterval(grow);
      finishBoot();
    });
    window.setTimeout(() => {
      window.clearInterval(tick);
      window.clearInterval(grow);
      finishBoot();
    }, 3600);
  }

  /* ---------- marquee: duplicate the track for a seamless loop ---------- */
  const track = document.querySelector("[data-marquee]");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- scroll pipeline ---------- */
  const topbar = document.getElementById("topbar");
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
    if (!reduced && window.innerWidth > 960) {
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

  /* ---------- progressive reveals ---------- */
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- magnetic buttons ---------- */
  if (fine) {
    const STRENGTH = 0.26;
    const MAX = 9;
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

    /* ---------- 3D tilt on cards ---------- */
    for (const el of document.querySelectorAll("[data-tilt]")) {
      const move = (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(
          2,
        )}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-6px)`;
      };
      const reset = () => {
        el.style.transform = "";
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", reset);
      el.addEventListener("blur", reset);
    }

    /* ---------- cursor sparkle trail (peak vibe) ---------- */
    let last = 0;
    window.addEventListener(
      "pointermove",
      (e) => {
        const now = performance.now();
        if (now - last < 70) return;
        last = now;
        const s = document.createElement("span");
        s.className = "sparkle";
        s.style.left = `${e.clientX}px`;
        s.style.top = `${e.clientY}px`;
        document.body.appendChild(s);
        window.setTimeout(() => s.remove(), 700);
      },
      { passive: true },
    );
  }

  /* ---------- nav scroll-spy ---------- */
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
            a.classList.toggle(
              "is-active",
              a.getAttribute("href") === `#${entry.target.id}`,
            ),
          );
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- "watch the demo" theatre ---------- */
  const toast = document.getElementById("toast");
  let toastTimer;
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-on");
      window.setTimeout(() => {
        toast.hidden = true;
      }, 320);
    }, 2600);
  };
  for (const btn of document.querySelectorAll("[data-fake-demo]")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showToast(
        "There is no demo. This button is the demo. (This page is a parody.)",
      );
    });
  }

  /* ---------- cookie banner (stored on the device only) ---------- */
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
    }, 1200);
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
