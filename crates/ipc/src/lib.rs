//! Internal contracts shared by the four RustZen backend applications.

mod delegation;
mod extract;
mod manifest;
mod router;

pub use delegation::{
    CONTRACT_VERSION, DelegatedAccess, DelegatedContext, DelegationError, DelegationSigner,
    DelegationVerifier, IPC_ACCESS_HEADER, IPC_CONTRACT_VERSION_HEADER, IPC_MODULE_HEADER,
    IPC_REQUEST_ID_HEADER, IPC_SIGNATURE_HEADER, IPC_TIMESTAMP_HEADER, IPC_USER_ID_HEADER,
};
pub use extract::{ModuleInputRejection, ModuleJson, ModuleJsonRejection, ModuleQuery};
pub use manifest::{
    AccessMode, ManifestError, MenuDefinition, ModuleDefinition, ModuleManifest, ModuleMetadata,
    RouteManifest,
};
pub use router::{ModuleRouter, Require};
