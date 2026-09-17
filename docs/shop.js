(() => {
 const dialog = document.querySelector('.zoom');
 if (!dialog) return;
 let trigger;
 document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
   trigger = button;
   dialog.querySelector('img').src = button.dataset.image;
   dialog.querySelector('img').alt = button.querySelector('img').alt;
   dialog.querySelector('p').textContent = button.querySelector('img').alt;
   // A verified clip can be attached with data-video; no media is fetched until opened.
   dialog.querySelector('video')?.remove();
   if (button.dataset.video) {
     const video = document.createElement('video');
     video.controls = true; video.preload = 'none'; video.playsInline = true;
     video.poster = button.dataset.image; video.src = button.dataset.video;
     video.style.width = '100%'; dialog.appendChild(video);
   }
   dialog.showModal();
 }));
 dialog.querySelector('button').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
 dialog.addEventListener('close', () => { dialog.querySelector('video')?.pause(); trigger?.focus(); });
 // Outbound links carry product and position labels. No click collection or analytics is installed.
})();
