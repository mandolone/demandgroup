(() => {
 const dialog = document.querySelector('.zoom');
 if (!dialog) return;
 let trigger;

 document.querySelectorAll('.product-gallery').forEach(gallery => {
   const main = gallery.querySelector('.image-open');
   const choices = [...gallery.querySelectorAll('.gallery-thumb')];
   let index = 0, origin, suppressUntil = 0;
   const select = next => {
     index = (next + choices.length) % choices.length;
     const choice = choices[index];
     gallery.querySelector('.gallery-motion')?.remove();
     main.hidden = false;
     main.dataset.image = choice.dataset.src;
     if (choice.dataset.video) main.dataset.video = choice.dataset.video;
     else delete main.dataset.video;
     main.querySelector('img').src = choice.dataset.src;
     main.querySelector('img').alt = choice.dataset.caption;
     gallery.querySelector('.gallery-caption').textContent = choice.dataset.caption;
     choices.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
     main.setAttribute('aria-label', choice.dataset.video ? 'Enlarge movement preview' : 'Enlarge watch face image');
     if (choice.dataset.video) {
       document.querySelectorAll('.gallery-motion').forEach(video => video.pause());
       const video = document.createElement('video');
       video.className = 'gallery-motion';
       video.controls = true; video.playsInline = true; video.preload = 'none';
       video.poster = choice.dataset.src; video.src = video.canPlayType('video/webm; codecs="vp9"') ? choice.dataset.video : choice.dataset.video.replace('-motion-alpha.webm', '-motion.mp4');
       video.setAttribute('aria-label', choice.dataset.caption);
       main.hidden = true; main.parentElement.appendChild(video);
       video.play().catch(() => {});
     }
   };
   choices.forEach((choice, i) => choice.addEventListener('click', () => select(i)));
   main.addEventListener('keydown', event => {
     if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
       event.preventDefault(); select(index + (event.key === 'ArrowRight' ? 1 : -1));
     }
   });
   main.addEventListener('dragstart', event => event.preventDefault());
   main.addEventListener('pointerdown', event => {
     if (!event.isPrimary || event.button !== 0) return;
     origin = {x:event.clientX, y:event.clientY};
     main.setPointerCapture(event.pointerId);
   });
   main.addEventListener('pointerup', event => {
     if (!origin) return;
     const dx = event.clientX-origin.x, dy = event.clientY-origin.y;
     if (Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)) {
       suppressUntil=Date.now()+400; select(index+(dx<0?1:-1));
     }
     origin=null;
   });
   main.addEventListener('pointercancel', () => { origin=null; });
   main.addEventListener('click', event => {
     if (Date.now()<suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
   }, true);
 });

 document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
   trigger = button;
   document.querySelectorAll('.gallery-motion').forEach(video => video.pause());
   dialog.querySelector('img').hidden = Boolean(button.dataset.video);
   dialog.querySelector('img').src = button.dataset.image;
   dialog.querySelector('img').alt = button.querySelector('img').alt;
   dialog.querySelector('p').textContent = button.querySelector('img').alt;
   // A verified clip can be attached with data-video; no media is fetched until opened.
   dialog.querySelector('video')?.remove();
   if (button.dataset.video) {
     const video = document.createElement('video');
     video.controls = true; video.preload = 'none'; video.playsInline = true;
     video.poster = button.dataset.image; video.src = video.canPlayType('video/webm; codecs="vp9"') ? button.dataset.video : button.dataset.video.replace('-motion-alpha.webm', '-motion.mp4');
     video.style.width = '100%'; dialog.appendChild(video);
   }
   dialog.showModal();
 }));
 dialog.querySelector('button').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
 dialog.addEventListener('close', () => { dialog.querySelector('video')?.remove(); trigger?.focus(); });
 document.addEventListener('visibilitychange', () => {
   if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause());
 });
 // Outbound links carry product and position labels. No click collection or analytics is installed.
})();
