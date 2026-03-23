async function boot() {
    try {
        await import('./server.js');
    } catch (err) { }
}
boot();
