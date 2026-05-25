fn ensure_bundled_plugins_placeholder() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
    let keep_dir = std::path::Path::new(&manifest_dir)
        .join("resources")
        .join("bundled_plugins")
        .join("_keep");
    if !keep_dir.exists() {
        std::fs::create_dir_all(&keep_dir).unwrap_or_else(|err| {
            panic!("failed to create bundled plugin placeholder dir: {}", err)
        });
    }

    let keep_file = keep_dir.join("KEEP");
    if !keep_file.exists() {
        std::fs::write(&keep_file, [])
            .unwrap_or_else(|err| panic!("failed to write bundled plugin placeholder: {}", err));
    }

    println!("cargo:rerun-if-changed={}", keep_file.display());
}

fn main() {
    ensure_bundled_plugins_placeholder();
    tauri_build::build()
}
