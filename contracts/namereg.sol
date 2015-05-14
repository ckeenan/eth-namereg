contract NameReg {

   event registerEvent(address indexed owner, bytes32 message, bool success);

   modifier isOwner(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (owner != tx.origin && cOwner != tx.origin) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   modifier nameAvailable(bytes32 name, bytes32 message) {
      address cOwner = addrByName[name];

      if (cOwner != 0x0)
         registerEvent(tx.origin, message, false);
      else {
         _
      }
   }

   modifier addrAvailable(address addr, bytes32 message) {
      bytes32 name = nameByAddr[addr];

      if (name != 0x0) {
         registerEvent(tx.origin, message, false);
      } else {
         _
      }
   }

   function NameReg() {
      owner = msg.sender;
   }

   function register(address newRegisterAddr, bytes32 name, bytes32[] epk, bytes32[] email) external nameAvailable(name, "register.nameUnavailable")  {
      if (msg.value > 0)
         newRegisterAddr.send(msg.value);

      bytes32 oldName = nameByAddr[newRegisterAddr];

      if (oldName != 0x0)
         addrByName[oldName] = 0x0;

      nameByAddr[newRegisterAddr] = name;
      addrByName[name] = newRegisterAddr;

      // save encrypted private key at registration
      userData[newRegisterAddr]["epk"] = epk;

      // save email at registration
      userData[newRegisterAddr]["email"] = email;

      registerEvent(newRegisterAddr, "register", true);
   }

   function release(bytes32 name) isOwner(name, "release.notOwner") {
      nameByAddr[tx.origin] = 0x0;
      addrByName[name] = 0x0;

      registerEvent(tx.origin, "release", true);
   }

   function transfer(bytes32 name, address newOwner) isOwner(name, "transfer.notOwner") addrAvailable(newOwner, "transfer.addrUnavailable") {
      nameByAddr[tx.origin] = 0x0;
      nameByAddr[newOwner] = name;
      addrByName[name] = newOwner;

      registerEvent(tx.origin, "transfer", true);
      registerEvent(newOwner, "transfer", true);
   }

   function transferDataField(bytes32 field, address newOwner) {
      userData[newOwner][field] = userData[tx.origin][field];
      delete userData[tx.origin][field];

      registerEvent(tx.origin, field, true);
      registerEvent(newOwner, field, true);
   }

   function editField(bytes32 f, bytes32[] input) external {
      userData[tx.origin][f] = input;

      registerEvent(tx.origin, f, true);
   }

   address public owner;

   mapping (address => mapping (bytes32 => bytes32[])) public userData;

   mapping (address => bytes32) public nameByAddr;
   mapping (bytes32 => address) public addrByName;
}    
