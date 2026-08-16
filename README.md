# TrustChain Verify

A blockchain-based academic certificate verification system that prevents certificate forgery using Ethereum smart contracts, IPFS storage, and cryptographic digital signatures.

## 🎯 Overview

TrustChain Verify is a hybrid blockchain system that:
- Issues tamper-proof academic certificates as NFTs
- Stores certificate PDFs on IPFS (decentralized storage)
- Enables verification through recruiter permission system
- Allows students to approve/decline verification requests (gas-free)

## 🏗️ Architecture

### Decentralized Components
- **Certificates**: Stored on Ethereum blockchain (Sepolia testnet)
- **Certificate Data**: Stored on IPFS with cryptographic hashes
- **Digital Signatures**: Issuer signatures verified on-chain
- **Ownership**: Managed via ERC-721 NFT standard

### Centralized Components
- **Approvals**: Stored off-chain for gas-free student experience
- **Backend API**: FastAPI server manages transactions
- **Transaction Submission**: Backend wallet pays gas fees

**Decentralization Score: 60% (Hybrid System)**

## 📊 Features

### For Institutions (Issuers)
- ✅ Mint certificates to student wallet addresses
- ✅ Upload PDFs to IPFS automatically
- ✅ Digital signature generation and verification
- ✅ Immutable certificate records on blockchain

### For Recruiters/Verifiers
- ✅ Verify certificate authenticity via PDF upload
- ✅ Request permission to view certificate details
- ✅ Tamper detection through IPFS hash comparison
- ✅ Automatic network switching (Sepolia)

### For Students (Certificate Owners)
- ✅ View all owned certificates
- ✅ See pending verification requests
- ✅ Approve/decline requests without gas fees
- ✅ Complete control over who verifies certificates

## 🛠️ Tech Stack

**Blockchain:**
- Solidity ^0.8.26
- Ethereum Sepolia Testnet
- OpenZeppelin Contracts (ERC-721, Ownable)
- Hardhat Development Framework

**Backend:**
- Python 3.9+
- FastAPI
- Web3.py
- Pinata IPFS API

**Frontend:**
- React 18
- ethers.js v6
- Axios
- ipfs-only-hash

## 📦 Installation

### Prerequisites
- Node.js (v16+)
- Python (v3.9+)
- MetaMask wallet
- Sepolia testnet ETH

### 1. Clone Repository
```bash
git clone https://github.com/altimitmineos/TrustChainVerify.git
cd TrustChainVerify
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
pip install fastapi uvicorn web3 python-dotenv requests python-multipart
```

### 3. Environment Setup

Create `.env` file in root directory:
```env
# Ethereum Configuration
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_private_key_here
PUBLIC_ADDRESS=your_public_address_here
CONTRACT_ADDRESS=deployed_contract_address_here

# IPFS Configuration
PINATA_JWT=your_pinata_jwt_token_here

# React Configuration
REACT_APP_CONTRACT_ADDRESS=deployed_contract_address_here
```

### 4. Deploy Smart Contract

```bash
npx hardhat compile
npx hardhat run Scripts/deploy.js --network sepolia
```

Copy the deployed contract address to `.env` files.

### 5. Start Backend Server

```bash
python Scripts/main.py
```

Server runs on `http://localhost:8000`

### 6. Start Frontend

```bash
npm start
```

Application runs on `http://localhost:3000`

## 🚀 Usage

### Issuing Certificates

1. Go to **Issuer Dashboard**
2. Fill in certificate details:
   - Recipient name
   - Certificate ID (unique)
   - Institution name
   - Issue date
   - Student wallet address
3. Upload PDF file
4. Click "Mint Certificate"
5. Transaction submitted automatically (institution pays gas)

### Verifying Certificates

1. Go to **Recruiter Portal**
2. Connect MetaMask wallet
3. Enter student's wallet address
4. Upload certificate PDF
5. Click "Verify Certificate"
6. System checks:
   - PDF authenticity (IPFS hash comparison)
   - Blockchain record existence
   - Verification permission status
7. If first time: Request sent to student
8. If approved: Certificate details displayed

### Managing Requests (Students)

1. Go to **Student Portal**
2. Connect MetaMask (certificate owner wallet)
3. Click "Refresh My Certificates"
4. View pending verification requests
5. Click **✓ Approve** or **✗ Decline**
6. No gas fees required (off-chain storage)

## 🔐 Security Features

- **Tamper-Proof**: Certificates stored on blockchain, immutable
- **Digital Signatures**: Issuer signatures verified cryptographically
- **IPFS Hashing**: PDF integrity checked via content addressing
- **Permission System**: Students control who verifies their certificates
- **Ownership Verification**: Only certificate owner can approve requests

## 📁 Project Structure

```
TrustChainVerify/
├── contracts/
│   └── Certification.sol          # Smart contract
├── Scripts/
│   ├── deploy.js                  # Deployment script
│   └── main.py                    # FastAPI backend
├── src/
│   ├── index.js                   # React entry point
│   ├── index.css                  # Styles
│   └── serverpage.js              # Main application
├── public/
│   └── index.html                 # HTML template
├── hardhat.config.ts              # Hardhat configuration
├── package.json                   # Node dependencies
├── tsconfig.json                  # TypeScript config
├── .env                           # Environment variables
├── .gitignore                     # Git ignore rules
├── approvals.json                 # Off-chain approval storage
└── README.md                      # Read Me
```

## ⚠️ Known Limitations

1. **Block Query Limit**: Can only query last 10,000 blocks (~33 hours)
2. **Scalability**: Event querying slows with many certificates
3. **Off-Chain Approvals**: Centralized storage (JSON file)
4. **Network Dependency**: Requires Sepolia testnet

## 🔄 Future Improvements

- [ ] Implement decentralized approval storage (OrbitDB/Ceramic)
- [ ] Add event indexing service (The Graph)
- [ ] Support certificate revocation mechanism
- [ ] Batch certificate issuance
- [ ] Multi-chain support (Polygon, Arbitrum)
- [ ] Certificate expiration handling
- [ ] Advanced analytics dashboard
- [ ] Mobile application

## 📄 License

This project is for academic purposes. All rights reserved.


## 🙏 Acknowledgments

- OpenZeppelin for secure smart contract libraries
- Ethereum Foundation for blockchain infrastructure
- IPFS/Pinata for decentralized storage
- Hardhat team for development framework

---

