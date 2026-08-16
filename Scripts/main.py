from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import requests
from web3 import Web3
from dotenv import load_dotenv
import shutil
from eth_account.messages import encode_defunct
from datetime import datetime

load_dotenv()

APPROVALS_FILE = "approvals.json"

def load_approvals():
    if os.path.exists(APPROVALS_FILE):
        with open(APPROVALS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_approvals(approvals):
    with open(APPROVALS_FILE, 'w') as f:
        json.dump(approvals, f, indent=2)

def get_approval_key(cert_id, recruiter):
    return f"{cert_id.upper()}:{recruiter.lower()}"

def set_approval(cert_id, recruiter, approved):
    approvals = load_approvals()
    key = get_approval_key(cert_id, recruiter)
    approvals[key] = {
        "certificateId": cert_id.upper(),
        "recruiter": recruiter.lower(),
        "approved": approved,
        "timestamp": datetime.now().isoformat()
    }
    save_approvals(approvals)

def check_approval(cert_id, recruiter):
    approvals = load_approvals()
    key = get_approval_key(cert_id, recruiter)
    return approvals.get(key, {}).get("approved", False)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RPC_URL = os.getenv("RPC_URL")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
PUBLIC_ADDRESS = os.getenv("PUBLIC_ADDRESS")
PINATA_JWT = os.getenv("PINATA_JWT")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"indexed": False, "internalType": "string", "name": "certificateId", "type": "string"},
            {"indexed": False, "internalType": "address", "name": "issuer", "type": "address"},
            {"indexed": False, "internalType": "address", "name": "recipient", "type": "address"}
        ],
        "name": "CertificateIssued",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": False, "internalType": "string", "name": "certificateId", "type": "string"},
            {"indexed": False, "internalType": "address", "name": "recruiter", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "VerificationRequested",
        "type": "event"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "studentWallet", "type": "address"},
            {"internalType": "string", "name": "certId", "type": "string"},
            {"internalType": "string", "name": "name", "type": "string"},
            {"internalType": "string", "name": "institution", "type": "string"},
            {"internalType": "string", "name": "ipfsLink", "type": "string"},
            {"internalType": "bytes", "name": "signature", "type": "bytes"}
        ],
        "name": "issueCertificate",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "certId", "type": "string"},
            {"internalType": "address", "name": "recruiter", "type": "address"}
        ],
        "name": "requestVerification",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "certId", "type": "string"},
            {"internalType": "address", "name": "recruiter", "type": "address"},
            {"internalType": "bool", "name": "approve", "type": "bool"}
        ],
        "name": "approveVerification",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "certId", "type": "string"},
            {"internalType": "address", "name": "recruiter", "type": "address"}
        ],
        "name": "hasVerificationPermission",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "certId", "type": "string"}],
        "name": "getCertificateById",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "certificateId", "type": "string"},
                    {"internalType": "string", "name": "personName", "type": "string"},
                    {"internalType": "string", "name": "institutionName", "type": "string"},
                    {"internalType": "uint256", "name": "issueDate", "type": "uint256"},
                    {"internalType": "string", "name": "ipfsLink", "type": "string"},
                    {"internalType": "address", "name": "issuer", "type": "address"},
                    {"internalType": "bytes", "name": "issuerSignature", "type": "bytes"}
                ],
                "internalType": "struct CertificateSystem.Certificate",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "certId", "type": "string"}],
        "name": "getCertificateOwner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "getMyCertificates",
        "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "getCertificateDetails",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "certificateId", "type": "string"},
                    {"internalType": "string", "name": "personName", "type": "string"},
                    {"internalType": "string", "name": "institutionName", "type": "string"},
                    {"internalType": "uint256", "name": "issueDate", "type": "uint256"},
                    {"internalType": "string", "name": "ipfsLink", "type": "string"},
                    {"internalType": "address", "name": "issuer", "type": "address"},
                    {"internalType": "bytes", "name": "issuerSignature", "type": "bytes"}
                ],
                "internalType": "struct CertificateSystem.Certificate",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
code = w3.eth.get_code(CONTRACT_ADDRESS)
print(f"--- Contract Check: {len(code)} bytes of code found at address ---")

def upload_to_pinata(file_path):
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    with open(file_path, "rb") as file:
        headers = {"Authorization": f"Bearer {PINATA_JWT}"}
        response = requests.post(url, files={"file": file}, headers=headers)
        if response.status_code == 200:
            return response.json()["IpfsHash"]
        else:
            raise Exception(f"Pinata Error: {response.text}")

print(f"DEBUG: Connecting to Contract at: {contract.address}")

@app.get("/")
def home():
    return {"message": "Certificate Issuance API is active"}

@app.post("/mint")
async def mint_certificate(
    student_wallet: str = Form(...),
    cert_id: str = Form(...),
    name: str = Form(...),
    institution: str = Form(...),
    date: str = Form(...),
    file: UploadFile = File(...)
):
    temp_path = f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        ipfs_hash = upload_to_pinata(temp_path)

        nonce = w3.eth.get_transaction_count(PUBLIC_ADDRESS)

        clean_cert_id = cert_id.strip().upper()

        display_name = f"{name} ({date})"

        # Create digital signature of certificate data
        message_to_sign = f"{clean_cert_id}:{display_name}:{institution}:{ipfs_hash}"
        message_hash = encode_defunct(text=message_to_sign)
        signed_message = w3.eth.account.sign_message(message_hash, private_key=PRIVATE_KEY)
        signature = signed_message.signature

        tx = contract.functions.issueCertificate(
            student_wallet,
            clean_cert_id,
            display_name,
            institution,
            f"ipfs://{ipfs_hash}",
            signature
        ).build_transaction({
            'chainId': 11155111,
            'gas': 500000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })

        signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return {
            "status": "success",
            "txHash": w3.to_hex(tx_hash),
            "explorerUrl": f"https://eth-sepolia.blockscout.com/tx/{w3.to_hex(tx_hash)}"
        }

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/request-verification")
async def request_verification(cert_id: str = Form(...), recruiter_address: str = Form(...)):
    try:
        clean_id = cert_id.strip().upper()
        
        # Get nonce including pending transactions
        nonce = w3.eth.get_transaction_count(PUBLIC_ADDRESS, 'pending')
        
        # Get current gas price and add 10% buffer
        base_gas_price = w3.eth.gas_price
        gas_price = int(base_gas_price * 1.1)
        
        tx = contract.functions.requestVerification(
            clean_id,
            recruiter_address
        ).build_transaction({
            'chainId': 11155111,
            'gas': 200000,
            'gasPrice': gas_price,
            'nonce': nonce,
        })

        signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

        return {
            "status": "success",
            "message": "Verification request created",
            "txHash": w3.to_hex(tx_hash)
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/offchain-approve")
async def offchain_approve(
    cert_id: str = Form(...),
    recruiter_address: str = Form(...),
    approve: bool = Form(...)
):
    """
    Store approval off-chain (FREE - no gas fees!)
    """
    try:
        clean_id = cert_id.strip().upper()
        recruiter = recruiter_address.strip()
        
        # Verify certificate exists
        try:
            owner = contract.functions.getCertificateOwner(clean_id).call()
        except:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        # Store approval off-chain
        set_approval(clean_id, recruiter, approve)
        
        print(f"✓ Off-chain approval stored: {clean_id} -> {recruiter} = {approve}")
        
        return {
            "status": "success",
            "message": f"Approval {'granted' if approve else 'declined'} (stored off-chain, no gas fees!)",
            "certificateId": clean_id,
            "recruiter": recruiter,
            "approved": approve
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error storing approval: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/verify/{cert_id}/{recruiter_address}")
async def verify_certificate(cert_id: str, recruiter_address: str):
    try:
        clean_id = cert_id.strip().upper()
        recruiter = recruiter_address.strip()
        
        # Check off-chain approval first (FREE!)
        has_approval = check_approval(clean_id, recruiter)
        
        if not has_approval:
            return {
                "status": "awaiting_approval",
                "message": "Awaiting student approval for verification",
                "verified": False
            }
        
        # If approved off-chain, return certificate data from blockchain
        data = contract.functions.getCertificateById(clean_id).call()

        return {
            "status": "approved",
            "ipfsLink": data[4],
            "issuer": data[5],
            "personName": data[1],
            "institution": data[2],
            "verified": True
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=404, detail="Certificate ID not found or data mismatch.")

@app.get("/get-certificate-owner/{cert_id}")
async def get_certificate_owner(cert_id: str):
    try:
        clean_id = cert_id.strip().upper()
        owner = contract.functions.getCertificateOwner(clean_id).call()
        return {"owner": owner}
    except Exception as e:
        raise HTTPException(status_code=404, detail="Certificate not found")

@app.get("/my-certificates/{wallet_address}")
async def get_my_certificates(wallet_address: str):
    try:
        token_ids = contract.functions.getMyCertificates(wallet_address).call()
        certificates = []
        
        for token_id in token_ids:
            cert_data = contract.functions.getCertificateDetails(token_id).call()
            
            # For each certificate, get pending verification requests
            # Note: This is a simplified approach - in production you'd query events
            cert_info = {
                "tokenId": token_id,
                "certificateId": cert_data[0],
                "personName": cert_data[1],
                "institutionName": cert_data[2],
                "issueDate": cert_data[3],
                "ipfsLink": cert_data[4],
                "issuer": cert_data[5],
                "pendingRequests": []  # Will be populated by frontend checking recent events
            }
            certificates.append(cert_info)
        
        return {"certificates": certificates}
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pending-requests/{cert_id}")
async def get_pending_requests(cert_id: str):
    """
    Get recent verification requests by querying events.
    Simplified approach with better error handling.
    """
    try:
        clean_id = cert_id.strip().upper()
        print(f"Fetching pending requests for certificate: {clean_id}")
        
        # Try to get recent events - use maximum allowed block range
        current_block = w3.eth.block_number
        from_block = max(0, current_block - 10000)  # Last ~10000 blocks (RPC limit, about 33 hours on Sepolia)
        
        print(f"Querying blocks from {from_block} to {current_block}")
        
        try:
            # Get VerificationRequested events (use snake_case for web3.py)
            events = contract.events.VerificationRequested.get_logs(
                from_block=from_block,
                to_block='latest'
            )
            
            print(f"Found {len(events)} total VerificationRequested events")
            
            # Filter events for this certificate
            # Use a dict to store only the LATEST request from each recruiter
            requests_by_recruiter = {}
            
            for event in events:
                event_cert_id = event['args']['certificateId']
                print(f"Event cert ID: {event_cert_id}, looking for: {clean_id}")
                
                if event_cert_id == clean_id:
                    recruiter = event['args']['recruiter']
                    timestamp = event['args']['timestamp']
                    
                    # Store only the latest request from this recruiter
                    if recruiter not in requests_by_recruiter or timestamp > requests_by_recruiter[recruiter]['timestamp']:
                        requests_by_recruiter[recruiter] = {
                            "recruiter": recruiter,
                            "timestamp": timestamp
                        }
            
            # Now check which requests are truly pending (not approved/declined)
            pending_requests = []
            approvals = load_approvals()
            
            for recruiter, request in requests_by_recruiter.items():
                key = get_approval_key(clean_id, recruiter)
                
                # Only include if NOT in approvals file (i.e., truly pending)
                if key not in approvals:
                    print(f"Found PENDING request from {recruiter}")
                    pending_requests.append({
                        "recruiter": request['recruiter'],
                        "timestamp": request['timestamp'],
                        "hasPermission": False  # Still pending
                    })
                else:
                    print(f"Skipping processed request from {recruiter} (approved={approvals[key].get('approved')})")
            
            print(f"Returning {len(pending_requests)} requests for certificate {clean_id}")
            return {"pendingRequests": pending_requests}
            
        except Exception as event_error:
            print(f"Event query failed: {event_error}")
            # If events don't work, return empty for now
            return {"pendingRequests": []}
        
    except Exception as e:
        print(f"Error fetching pending requests: {e}")
        import traceback
        traceback.print_exc()
        return {"pendingRequests": []}

@app.get("/test-data")
async def test_data():
    try:
        name = contract.functions.name().call()
        owner = contract.functions.ownerOf(1).call()
        return {"status": "Contract Live", "name": name, "owner_of_token_1": owner}
    except Exception as e:
        return {"error": str(e), "checked_address": contract.address}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
