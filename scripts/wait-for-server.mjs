for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const r = await fetch(process.argv[2] || "http://127.0.0.1:3000");
    if (r.ok) process.exit(0);
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw Error("Local server did not start");
