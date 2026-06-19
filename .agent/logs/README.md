# Logs

Guardar aqui logs temporales de ejecuciones locales.

Archivo recomendado:

```txt
.agent/logs/execution.log
```

Formato recomendado:

```txt
[2026-06-19 15:00:00] Started task 001
[2026-06-19 15:05:00] Modified file src/routes/users.py
[2026-06-19 15:08:00] Ran tests
[2026-06-19 15:10:00] Finished task 001 with status success
```

No guardar tokens, contrasenas, JWTs, credenciales de base de datos ni datos sensibles.

Los logs generados se ignoran por defecto en Git, excepto este README.
