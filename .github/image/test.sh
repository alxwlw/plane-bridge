#!/usr/bin/env bash
# Cases for tags.sh and platforms.sh. One line per case; exit 1 if any case fails.
set -uo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
tags=$here/tags.sh
platforms=$here/platforms.sh
image=ghcr.io/alxwlw/plane-hooks
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0

# check <name> <want exit> <want stdout> <want stderr> -- <command...>   (stdin passes through)
check() {
  local name=$1 want_rc=$2 want_out=$3 want_err=$4 rc out err
  shift 5
  out=$("$@" 2>"$work/err")
  rc=$?
  err=$(<"$work/err")
  if [ "$rc" = "$want_rc" ] && [ "$out" = "$want_out" ] && [ "$err" = "$want_err" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: exit $rc (want $want_rc), stdout '$out' (want '$want_out'), stderr '$err' (want '$want_err')"
    failed=1
  fi
}

tags_case() { # <name> <input> <rc> <out> <err>
  local name=$1 input=$2
  shift 2
  check "tags.sh $name" "$1" "$2" "$3" -- "$tags_run" "$input"
}
tags_run=$work/tags_run
cat >"$tags_run" <<EOS
#!/usr/bin/env bash
printf '%b' "\$1" | "$tags" "$image"
EOS
chmod +x "$tags_run"

a128=$(printf 'a%.0s' $(seq 128))
a129=${a128}a
tags_case 'trims and drops empty lines' 'main\n  abc123  \n\n' 0 "$image:main
$image:abc123" ''
tags_case 'keeps input order' '0.1.0-rc.1\n0.1\nlatest\n' 0 "$image:0.1.0-rc.1
$image:0.1
$image:latest" ''
tags_case '128 characters' "$a128\\n" 0 "$image:$a128" ''
tags_case '129 characters' "$a129\\n" 2 '' "tags.sh: invalid tag '$a129'"
tags_case 'space inside' 'bad tag\n' 2 '' "tags.sh: invalid tag 'bad tag'"
tags_case 'leading colon' ':main\n' 2 '' "tags.sh: invalid tag ':main'"
tags_case 'leading dot' '.x\n' 2 '' "tags.sh: invalid tag '.x'"
tags_case 'leading dash' '-x\n' 2 '' "tags.sh: invalid tag '-x'"
tags_case 'slash' 'a/b\n' 2 '' "tags.sh: invalid tag 'a/b'"
tags_case 'blank lines only' '\n  \n' 2 '' 'tags.sh: no tags'
tags_case 'empty input' '' 2 '' 'tags.sh: no tags'

# Non-ASCII under a locale whose ranges fold: pick one where [A-Za-z] matches 'é'.
locale_found=
for candidate in en_US.UTF-8 en_US.utf8 C.UTF-8 C.utf8; do
  if LC_ALL=$candidate bash -c '[[ "é" =~ ^[A-Za-z]$ ]]' 2>/dev/null; then
    locale_found=$candidate
    break
  fi
done
if [ -n "$locale_found" ]; then
  check "tags.sh non-ASCII under $locale_found" 2 '' "tags.sh: invalid tag 'été'" -- \
    env LC_ALL="$locale_found" bash -c "printf 'été\n' | '$tags' '$image'"
else
  echo "skip tags.sh non-ASCII: no installed locale folds [A-Za-z] over é"
fi

# platforms.sh against a stub docker that prints a canned manifest.
mkdir "$work/bin"
cat >"$work/bin/docker" <<'EOS'
#!/usr/bin/env bash
cat "$STUB_MANIFEST"
EOS
chmod +x "$work/bin/docker"
platforms_case() { # <name> <manifest json> <rc> <out> <err>
  local name=$1
  printf '%s\n' "$2" >"$work/manifest.json"
  shift 2
  check "platforms.sh $name" "$1" "$2" "$3" -- \
    env PATH="$work/bin:$PATH" STUB_MANIFEST="$work/manifest.json" "$platforms" ref:x
}
amd='{"platform":{"os":"linux","architecture":"amd64"}}'
arm='{"platform":{"os":"linux","architecture":"arm64"}}'
att='{"platform":{"os":"unknown","architecture":"unknown"}}'
platforms_case 'both platforms and attestations' \
  "{\"digest\":\"sha256:abc\",\"manifests\":[$amd,$arm,$att,$att]}" 0 'sha256:abc' ''
platforms_case 'amd64 and attestation only' \
  "{\"digest\":\"sha256:abc\",\"manifests\":[$amd,$att]}" 1 '' 'platforms.sh: ref:x lacks linux/arm64'
platforms_case 'single manifest' \
  '{"digest":"sha256:abc","mediaType":"application/vnd.oci.image.manifest.v1+json"}' 1 '' \
  'platforms.sh: ref:x lacks linux/amd64'

# description.sh against the real Dockerfiles and fixtures.
description=$here/description.sh
root=$(cd "$here/../.." && pwd)
check 'description.sh plane-hooks' 0 \
  'Plane App that moves Plane work items by their pull requests and deploys and opens incidents from alerts.' '' -- \
  "$description" "$root/apps/plane-hooks/Dockerfile"
check 'description.sh plane-discord' 0 \
  'Plane App that bridges Plane and Discord: notifications, work items from messages, cards and synced threads.' '' -- \
  "$description" "$root/apps/plane-discord/Dockerfile"
check 'description.sh plane-miro' 0 \
  'Plane App that links Plane and Miro: stickies become work items and their cards show the state.' '' -- \
  "$description" "$root/apps/plane-miro/Dockerfile"
check 'description.sh plane-graph' 0 \
  'Plane App that draws the order of work in a Plane workspace and serves the same data to an agent.' '' -- \
  "$description" "$root/apps/plane-graph/Dockerfile"
printf 'FROM scratch\nLABEL org.opencontainers.image.title="x"\n' >"$work/none.Dockerfile"
printf 'FROM scratch\nLABEL org.opencontainers.image.description="one" \\\n      org.opencontainers.image.description="two"\n' >"$work/two.Dockerfile"
printf 'FROM scratch\nLABEL org.opencontainers.image.description=""\n' >"$work/empty.Dockerfile"
printf 'FROM scratch\nLABEL org.opencontainers.image.description="solo one-line"\n' >"$work/single.Dockerfile"
check 'description.sh single-line LABEL' 0 'solo one-line' '' -- "$description" "$work/single.Dockerfile"
check 'description.sh no label' 1 '' "description.sh: $work/none.Dockerfile: no org.opencontainers.image.description label" -- \
  "$description" "$work/none.Dockerfile"
check 'description.sh two labels' 1 '' "description.sh: $work/two.Dockerfile: more than one org.opencontainers.image.description label" -- \
  "$description" "$work/two.Dockerfile"
check 'description.sh empty value' 1 '' "description.sh: $work/empty.Dockerfile: empty org.opencontainers.image.description" -- \
  "$description" "$work/empty.Dockerfile"
check 'description.sh no argument' 2 '' 'usage: description.sh <dockerfile>' -- "$description"
check 'description.sh missing file' 2 '' 'usage: description.sh <dockerfile>' -- "$description" "$work/absent.Dockerfile"
check 'image.yml annotates the description' 0 'index:org.opencontainers.image.description=' '' -- \
  grep -o -F 'index:org.opencontainers.image.description=' "$root/.github/workflows/image.yml"

exit "$failed"
