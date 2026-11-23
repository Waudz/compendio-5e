"""Configure ONLY a freshly initialized temporary CLI project. No remote commands."""
import pathlib, re, shutil, sys, tomllib
root = pathlib.Path(sys.argv[1]).resolve()
repo = pathlib.Path(__file__).resolve().parents[2]
assert root != repo and root.is_relative_to(pathlib.Path('/tmp')), 'Temporary workdir required'
assert not (root / 'supabase/.temp/project-ref').exists(), 'Linked project forbidden'
p = root / 'supabase/config.toml'
text = p.read_text()
text = re.sub(r'^project_id = .*$', 'project_id = "compendio-alpha-isolated"', text, flags=re.M)
text = text.replace('jwt_expiry = 3600', 'jwt_expiry = 60')
# [auth] controls new registration; email auth remains enabled for existing accounts.
text = text.replace('enable_signup = true', 'enable_signup = false')
config = tomllib.loads(text)
assert config['auth']['enable_signup'] is False
assert config['auth']['jwt_expiry'] == 60
assert config['auth']['email']['enabled'] is True
p.write_text(text)
destination = root / 'supabase/migrations'
destination.mkdir(exist_ok=True)
assert not list(destination.glob('*.sql')), 'Fresh database migrations directory required'
for migration in sorted((repo / 'supabase/migrations').glob('*.sql')):
    shutil.copyfile(migration, destination / migration.name)
