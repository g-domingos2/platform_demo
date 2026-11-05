
/* Toast Notification System */
(function notificationSystem() {
    "use strict";

    function showToast(message, type = 'success', duration = 2500) {
        let toast = document.getElementById('icToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'icToast';
            document.body.appendChild(toast);
        }
        toast.className = `ic-toast ic-toast--${type === 'error' ? 'error' : 'success'}`;

        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        // Reset display
        toast.classList.remove('is-visible');

        // Use timeout to ensure animation triggers if it was already showing
        setTimeout(() => {
            toast.classList.add('is-visible');

            setTimeout(() => {
                toast.classList.remove('is-visible');
            }, duration);
        }, 50);
    }

    // Expose globally
    window.IcNotify = {
        success: (msg, dur) => showToast(msg, 'success', dur),
        error: (msg, dur) => showToast(msg, 'error', dur)
    };
})();
