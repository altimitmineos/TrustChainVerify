pragma solidity ^0.8.26;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateSystem is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;

    struct Certificate {
        string certificateId;
        string personName;
        string institutionName;
        uint256 issueDate;
        string ipfsLink;
        address issuer;
        bytes issuerSignature;
    }

    struct VerificationRequest {
        address recruiter;
        uint256 timestamp;
        bool approved;
        bool exists;
    }

    mapping(uint256 => Certificate) public certificates;
    mapping(string => uint256) public certificateIdToTokenId;
    mapping(bytes32 => VerificationRequest) public verificationRequests;

    event CertificateIssued(uint256 indexed tokenId, string certificateId, address issuer, address recipient);
    event VerificationRequested(string certificateId, address recruiter, uint256 timestamp);
    event VerificationApproved(string certificateId, address recruiter, bool approved);

    constructor() ERC721("BlockchainCertificate", "B-CERT") Ownable(msg.sender) {}

    function issueCertificate(
        address studentWallet,
        string memory certId,
        string memory name,
        string memory institution,
        string memory ipfsLink,
        bytes memory signature
    ) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newItemId = _tokenIds;

        _mint(studentWallet, newItemId);
        _setTokenURI(newItemId, ipfsLink);

        certificates[newItemId] = Certificate(
            certId,
            name,
            institution,
            block.timestamp,
            ipfsLink,
            msg.sender,
            signature
        );

        certificateIdToTokenId[certId] = newItemId;

        emit CertificateIssued(newItemId, certId, msg.sender, studentWallet);

        return newItemId;
    }

    function requestVerification(string memory certId, address recruiter) public {
        uint256 tokenId = certificateIdToTokenId[certId];
        require(tokenId != 0, "Certificate ID not found");

        bytes32 requestId = keccak256(abi.encodePacked(certId, recruiter));
        
        verificationRequests[requestId] = VerificationRequest({
            recruiter: recruiter,
            timestamp: block.timestamp,
            approved: false,
            exists: true
        });

        emit VerificationRequested(certId, recruiter, block.timestamp);
    }

    function approveVerification(string memory certId, address recruiter, bool approve) public {
        uint256 tokenId = certificateIdToTokenId[certId];
        require(tokenId != 0, "Certificate ID not found");
        require(ownerOf(tokenId) == msg.sender, "Only certificate owner can approve");

        bytes32 requestId = keccak256(abi.encodePacked(certId, recruiter));
        require(verificationRequests[requestId].exists, "Verification request not found");

        verificationRequests[requestId].approved = approve;

        emit VerificationApproved(certId, recruiter, approve);
    }

    function hasVerificationPermission(string memory certId, address recruiter) public view returns (bool) {
        bytes32 requestId = keccak256(abi.encodePacked(certId, recruiter));
        return verificationRequests[requestId].approved;
    }

    function getVerificationRequest(string memory certId, address recruiter) public view returns (VerificationRequest memory) {
        bytes32 requestId = keccak256(abi.encodePacked(certId, recruiter));
        return verificationRequests[requestId];
    }

    function getCertificateDetails(uint256 tokenId) public view returns (Certificate memory) {
        _requireOwned(tokenId);
        return certificates[tokenId];
    }

    function getCertificateById(string memory certId) public view returns (Certificate memory) {
        uint256 tokenId = certificateIdToTokenId[certId];
        require(tokenId != 0, "Certificate ID not found");
        return certificates[tokenId];
    }

    function getCertificateOwner(string memory certId) public view returns (address) {
        uint256 tokenId = certificateIdToTokenId[certId];
        require(tokenId != 0, "Certificate ID not found");
        return ownerOf(tokenId);
    }

    function getMyCertificates(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 counter = 0;

        for (uint256 i = 1; i <= _tokenIds; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[counter] = i;
                counter++;
            }
        }

        return tokenIds;
    }
}
