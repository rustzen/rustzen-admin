use aes_gcm::{
    Aes256Gcm, KeyInit, Nonce,
    aead::{Aead, OsRng, rand_core::RngCore},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use sha2::{Digest, Sha256};

use crate::common::error::AppError;

#[derive(Clone)]
pub struct CredentialCipher {
    cipher: Aes256Gcm,
}

impl CredentialCipher {
    pub fn new(secret: &str) -> Self {
        let key = Sha256::digest(secret.as_bytes());
        Self { cipher: Aes256Gcm::new(&key) }
    }

    pub fn encrypt(&self, value: &str) -> Result<(String, String), AppError> {
        let mut nonce_bytes = [0_u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);
        let ciphertext =
            self.cipher.encrypt(&nonce, value.as_bytes()).map_err(AppError::internal)?;
        Ok((STANDARD.encode(ciphertext), STANDARD.encode(nonce_bytes)))
    }

    pub fn decrypt(&self, ciphertext: &str, nonce: &str) -> Result<String, AppError> {
        let ciphertext = STANDARD.decode(ciphertext).map_err(AppError::internal)?;
        let nonce: [u8; 12] = STANDARD
            .decode(nonce)
            .map_err(AppError::internal)?
            .try_into()
            .map_err(|_| AppError::InvalidInput("invalid credential nonce".into()))?;
        let nonce = Nonce::from(nonce);
        let plaintext =
            self.cipher.decrypt(&nonce, ciphertext.as_ref()).map_err(AppError::internal)?;
        String::from_utf8(plaintext).map_err(AppError::internal)
    }
}
