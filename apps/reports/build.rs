fn main() {
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=module.toml");
}
