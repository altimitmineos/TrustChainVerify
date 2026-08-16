import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Hash from 'ipfs-only-hash';
import { ethers } from 'ethers';
import './index.css';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS;

const CONTRACT_ABI = [
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
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "getMyCertificates",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
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
  }
];

export default function CertificateApp() {
  const [activeTab, setActiveTab] = useState('issuer');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);

  const [mintData, setMintData] = useState({
    name: '',
    id: '',
    inst: '',
    wallet: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [certFile, setCertFile] = useState(null);
  const [mintStatus, setMintStatus] = useState('');

  const [verifyWallet, setVerifyWallet] = useState('');
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);

  const [myCertificates, setMyCertificates] = useState([]);
  const [certificateRequests, setCertificateRequests] = useState({});

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask to use this feature!');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setWalletAddress(address);
      setWalletConnected(true);
      alert(`Connected: ${address}`);
    } catch (error) {
      alert('Failed to connect wallet');
    }
  };

  const loadMyCertificates = async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      const response = await axios.get(`http://localhost:8000/my-certificates/${walletAddress}`);
      const certs = response.data.certificates;
      setMyCertificates(certs);
      
      const requestsMap = {};
      for (const cert of certs) {
        try {
          const requestsResponse = await axios.get(`http://localhost:8000/pending-requests/${cert.certificateId}`);
          requestsMap[cert.certificateId] = requestsResponse.data.pendingRequests;
        } catch (error) {
          requestsMap[cert.certificateId] = [];
        }
      }
      setCertificateRequests(requestsMap);
      
    } catch (error) {
      setMyCertificates([]);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    
    if (!mintData.wallet || !ethers.isAddress(mintData.wallet)) {
      setMintStatus('ERROR: Please enter a valid Ethereum wallet address!');
      return;
    }

    setMintStatus('Uploading to IPFS and Minting...');
    const formData = new FormData();
    formData.append('student_wallet', mintData.wallet);
    formData.append('cert_id', mintData.id);
    formData.append('name', mintData.name);
    formData.append('institution', mintData.inst);
    formData.append('date', mintData.date);
    formData.append('file', certFile);

    try {
      const res = await axios.post('http://localhost:8000/mint', formData);
      setMintStatus(`✅ Success! Certificate minted to ${mintData.wallet}. View transaction: https://eth-sepolia.blockscout.com/tx/${res.data.txHash}`);
    } catch (err) {
      setMintStatus('❌ Minting failed. Check if FastAPI is running and wallet address is valid.');
    }
  };

  const handleVerify = async () => {
    if (!walletConnected) {
      alert('Please connect your wallet first to verify certificates!');
      return;
    }

    setVerifyResult('Checking certificates...');

    try {
      if (!verifyFile || !verifyWallet) {
        setVerifyResult('ERROR: Please provide both student wallet address and PDF file.');
        return;
      }

      if (!ethers.isAddress(verifyWallet)) {
        setVerifyResult('ERROR: Invalid wallet address format.');
        return;
      }

      const certsResponse = await axios.get(`http://localhost:8000/my-certificates/${verifyWallet}`);
      const certificates = certsResponse.data.certificates;

      if (certificates.length === 0) {
        setVerifyResult('ERROR: No certificates found for this wallet address.');
        return;
      }

      const fileBuffer = await verifyFile.arrayBuffer();
      const localCid = await Hash.of(new Uint8Array(fileBuffer));

      let matchedCert = null;
      for (const cert of certificates) {
        const blockchainCid = cert.ipfsLink.replace('ipfs://', '');
        if (localCid === blockchainCid) {
          matchedCert = cert;
          break;
        }
      }

      if (!matchedCert) {
        setVerifyResult('INVALID ✗ - The file is invalid or has been tampered with. No matching certificate found on the blockchain.');
        return;
      }

      const requestFormData = new FormData();
      requestFormData.append('cert_id', matchedCert.certificateId);
      requestFormData.append('recruiter_address', walletAddress);

      await axios.post('http://localhost:8000/request-verification', requestFormData);

      const response = await axios.get(`http://localhost:8000/verify/${matchedCert.certificateId}/${walletAddress}`);

      if (response.data.status === 'awaiting_approval') {
        setVerifyResult(`AWAITING APPROVAL: Verification request sent to ${verifyWallet.substring(0, 6)}...${verifyWallet.substring(38)} for Certificate ID: ${matchedCert.certificateId}`);
        return;
      }

      setVerifyResult(`VALID ✓ - Certificate: ${matchedCert.certificateId} | Issued by: ${response.data.institution} | Recipient: ${response.data.personName}`);

    } catch (err) {
      setVerifyResult('ERROR: Connection failed or wallet has no certificates.');
    }
  };

  const handleApproval = async (certId, recruiterAddress, approve) => {
    if (!walletConnected) {
      alert('❌ Please connect your wallet first!');
      return;
    }

    if (!recruiterAddress || recruiterAddress.trim() === '') {
      alert('❌ Please enter a recruiter address!');
      return;
    }

    if (!ethers.isAddress(recruiterAddress)) {
      alert('❌ Invalid Ethereum address format!');
      return;
    }

    try {
      const ownerResponse = await axios.get(`http://localhost:8000/get-certificate-owner/${certId}`);
      const certOwner = ownerResponse.data.owner;
      
      if (walletAddress.toLowerCase() !== certOwner.toLowerCase()) {
        alert(`❌ Wrong wallet!\n\nThis certificate belongs to: ${certOwner}\n\nYou are connected as: ${walletAddress}\n\nPlease switch to the certificate owner's wallet in MetaMask.`);
        return;
      }

      const formData = new FormData();
      formData.append('cert_id', certId);
      formData.append('recruiter_address', recruiterAddress);
      formData.append('approve', approve);

      const response = await axios.post('http://localhost:8000/offchain-approve', formData);
      
      alert(approve 
        ? '✅ Verification APPROVED!\n\n✨ No gas fees paid!\n\nStored off-chain in backend database.' 
        : '❌ Verification DECLINED!\n\n✨ No gas fees paid!\n\nStored off-chain in backend database.');
      
      loadMyCertificates();
      
    } catch (error) {
      if (error.response) {
        alert(`❌ Failed to process approval:\n\n${error.response.data.detail || error.response.data.message || 'Unknown error'}`);
      } else {
        alert(`❌ Failed to process approval:\n\n${error.message}`);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'student' && walletConnected) {
      loadMyCertificates();
    }
  }, [activeTab, walletConnected]);

  return (
    <div className="container">
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#2c3e50', fontSize: '2.5rem', marginBottom: '10px' }}>TrustChain Verify</h1>
        <p style={{ color: '#7f8c8d', fontSize: '1.1rem' }}>Blockchain-Based Academic Integrity System</p>
        
        <div style={{ marginTop: '20px' }}>
          {!walletConnected ? (
            <button onClick={connectWallet} style={{ backgroundColor: '#3498db', padding: '10px 20px' }}>
              Connect MetaMask Wallet
            </button>
          ) : (
            <div style={{ color: '#27ae60', fontWeight: 'bold' }}>
              🟢 Connected: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
        <button 
          onClick={() => setActiveTab('issuer')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'issuer' ? '#3498db' : '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Issuer Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('recruiter')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'recruiter' ? '#27ae60' : '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Recruiter Portal
        </button>
        <button 
          onClick={() => setActiveTab('student')}
          style={{ 
            padding: '10px 20px',
            backgroundColor: activeTab === 'student' ? '#e74c3c' : '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Student Portal
        </button>
      </div>

      <div className="max-w-3xl mx-auto">
        {activeTab === 'issuer' && (
          <div className="section-card" style={{ borderTop: '5px solid #3498db' }}>
            <h2 className="text-xl font-bold mb-4">Issue Certificate (Admin)</h2>
            <form onSubmit={handleMint}>
              <div className="form-grid">
                <input 
                  type="text" 
                  placeholder="Recipient Name" 
                  value={mintData.name}
                  onChange={e => setMintData({ ...mintData, name: e.target.value })} 
                  required
                />
                <input 
                  type="text" 
                  placeholder="Certificate ID" 
                  value={mintData.id}
                  onChange={e => setMintData({ ...mintData, id: e.target.value })} 
                  required
                />
                <input 
                  type="text" 
                  placeholder="Institution Name" 
                  value={mintData.inst}
                  onChange={e => setMintData({ ...mintData, inst: e.target.value })} 
                  required
                />
                <input 
                  type="date" 
                  value={mintData.date} 
                  onChange={e => setMintData({ ...mintData, date: e.target.value })} 
                />
                <input 
                  type="text" 
                  placeholder="Student Wallet Address (0x...)" 
                  value={mintData.wallet}
                  onChange={e => setMintData({ ...mintData, wallet: e.target.value })} 
                  required
                  style={{ gridColumn: '1 / -1', fontFamily: 'monospace' }}
                />
              </div>
              <input 
                type="file" 
                onChange={e => setCertFile(e.target.files[0])} 
                required
              />
              <button type="submit" style={{ marginTop: '15px' }}>Mint Certificate with Digital Signature</button>
            </form>
            {mintStatus && <div className="status-msg" style={{ backgroundColor: '#eef2f7', marginTop: '10px' }}>{mintStatus}</div>}
          </div>
        )}

        {activeTab === 'recruiter' && (
          <div className="section-card" style={{ borderTop: '5px solid #27ae60' }}>
            <h2 className="text-xl font-bold mb-4">Verify Certificate (Recruiter)</h2>
            <p style={{ marginBottom: '15px', color: '#7f8c8d' }}>
              📝 Note: Connect your wallet and enter the student's wallet address + their certificate PDF.
            </p>
            <input 
              type="text" 
              placeholder="Student's Wallet Address (0x...)" 
              style={{ marginBottom: '15px', fontFamily: 'monospace' }} 
              value={verifyWallet}
              onChange={e => setVerifyWallet(e.target.value)} 
            />
            <input 
              type="file" 
              onChange={e => setVerifyFile(e.target.files[0])} 
            />
            <button onClick={handleVerify} className="verify-btn" style={{ marginTop: '15px' }}>
              Verify Certificate
            </button>

            {verifyResult?.includes('VALID') && !verifyResult?.includes('INVALID') && (
              <div className="status-msg success">{verifyResult}</div>
            )}
            {verifyResult?.includes('INVALID') && (
              <div className="status-msg error">{verifyResult}</div>
            )}
            {verifyResult?.includes('AWAITING') && (
              <div className="status-msg" style={{ backgroundColor: '#fff3cd', color: '#856404' }}>{verifyResult}</div>
            )}
            {verifyResult?.startsWith('ERROR') && !verifyResult?.includes('INVALID') && (
              <div className="status-msg error">{verifyResult}</div>
            )}
          </div>
        )}

        {activeTab === 'student' && (
          <div className="section-card" style={{ borderTop: '5px solid #e74c3c' }}>
            <h2 className="text-xl font-bold mb-4">My Certificates & Approvals</h2>
            
            {!walletConnected ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
                <p>Please connect your MetaMask wallet to view your certificates.</p>
              </div>
            ) : (
              <>
                <button onClick={loadMyCertificates} style={{ marginBottom: '20px' }}>
                  🔄 Refresh My Certificates
                </button>

                {myCertificates.length === 0 ? (
                  <p style={{ color: '#7f8c8d', textAlign: 'center' }}>No certificates found for this wallet.</p>
                ) : (
                  <div>
                    <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Your Certificates:</h3>
                    {myCertificates.map((cert, index) => (
                      <div key={index} style={{ 
                        border: '1px solid #ddd', 
                        padding: '15px', 
                        marginBottom: '15px',
                        borderRadius: '8px',
                        backgroundColor: '#f9f9f9'
                      }}>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Certificate ID:</strong> {cert.certificateId}
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Name:</strong> {cert.personName}
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Institution:</strong> {cert.institutionName}
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Token ID:</strong> #{cert.tokenId}
                        </div>
                        <div style={{ fontSize: '0.9em', color: '#7f8c8d' }}>
                          <strong>Issuer:</strong> {cert.issuer}
                        </div>
                        
                        <div style={{ marginTop: '15px' }}>
                          {certificateRequests[cert.certificateId] && certificateRequests[cert.certificateId].filter(req => !req.hasPermission).length > 0 ? (
                            <div>
                              <p style={{ fontSize: '0.9em', fontWeight: 'bold', marginBottom: '10px', color: '#2c3e50' }}>
                                🔔 Pending Verification Requests:
                              </p>
                              {certificateRequests[cert.certificateId].filter(req => !req.hasPermission).map((request, idx) => (
                                <div key={idx} style={{ 
                                  padding: '10px', 
                                  marginBottom: '10px',
                                  backgroundColor: request.hasPermission ? '#d4edda' : '#fff3cd',
                                  border: `1px solid ${request.hasPermission ? '#c3e6cb' : '#ffc107'}`,
                                  borderRadius: '5px'
                                }}>
                                  <div style={{ marginBottom: '8px', fontSize: '0.85em' }}>
                                    <strong>Recruiter:</strong> {request.recruiter.substring(0, 6)}...{request.recruiter.substring(38)}
                                  </div>
                                  <div style={{ marginBottom: '8px', fontSize: '0.85em' }}>
                                    <strong>Status:</strong> ⏳ Pending
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                      <button 
                                        onClick={() => handleApproval(cert.certificateId, request.recruiter, true)}
                                        style={{ 
                                          flex: 1,
                                          backgroundColor: '#27ae60', 
                                          padding: '8px 15px', 
                                          color: 'white', 
                                          border: 'none', 
                                          borderRadius: '4px', 
                                          cursor: 'pointer',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button 
                                        onClick={() => handleApproval(cert.certificateId, request.recruiter, false)}
                                        style={{ 
                                          flex: 1,
                                          backgroundColor: '#e74c3c', 
                                          padding: '8px 15px', 
                                          color: 'white', 
                                          border: 'none', 
                                          borderRadius: '4px', 
                                          cursor: 'pointer',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        ✗ Decline
                                      </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: '0.85em', color: '#7f8c8d', fontStyle: 'italic' }}>
                              No pending verification requests
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
