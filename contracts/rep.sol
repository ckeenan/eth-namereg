contract Rep_Trimmed {
    //admin priming removed to fit into gas costs
 
    event registerEvent(address indexed user, bytes32 message, bool result);
 
    modifier isAdmin() {
        if (msg.sender == admin) {
            _
        }
    }
 
    modifier eventModifier(address _user, bytes32 _message, bool _result) {
        _
        registerEvent(_user, _message, _result);
    }
 
    function Rep_Trimmed() {
        admin = msg.sender;
    }
 
    function submitVerifiedLink(bytes32[] _link) external eventModifier(msg.sender, "submit.VerifiedLink", true) {
        users[msg.sender].verifiedLink = _link;
    }
 
    function setVerified(address _for, bool _status) isAdmin eventModifier(_for, "changedVerified", _status) {
        users[_for].verified = _status; //oracle sets verified or not
    }
 
    function createRep(address _for, uint _amount) private eventModifier(_for, "rep.created", true) {
        users[_for].balance += _amount; //make sure, 0 is default.
    }
 
    function unlockRep(address _for, bytes32 _reward) isAdmin {
        createRep(_for, rewards[_reward]);
    }
 
    function setReward(bytes32 _action, uint _amount) isAdmin {
        rewards[_action] = _amount;
    }
 
    //send rep to another.
    function beam(address _to, uint _amount) {
        if (_amount > 0) {
            if(users[msg.sender].balance >= _amount) {
                users[msg.sender].balance -= _amount;
                users[_to].balance += _amount;
 
                registerEvent(msg.sender, "beam.sent", true);
                registerEvent(_to, "beam.received", true);
            }
        }
 
        link(msg.sender, _to);
    }
 
    //at every beam, see if they've connected. If not & verified, issue 1 token each.
    function link(address _to) private {
        address _from = msg.sender;
        if(users[_from].verified == true && users[_to].verified == true) {
            //Not really necessary to check both, but might want to async in the future.
            if(links[_from][_to] == false && links[_to][_from] == false) {
                links[_from][_to] = true;
                links[_to][_from] = true;
 
                registerEvent(_from, "link.from", true);
                registerEvent(_to, "link.to", true);
 
                createRep(_from, 1);
                createRep(_to, 1);
            }
        }
    }
 
 
    struct user {
        uint balance;
        bool verified;
        bytes32[] verifiedLink;
    }

    mapping (bytes32 => uint) public rewards;
    mapping (address => user) public users;
    mapping (address => mapping (address => bool)) public links;
    address public admin;
}  
